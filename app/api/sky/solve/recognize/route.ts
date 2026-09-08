/**
 * POST /api/sky/solve/recognize
 * Image recognition endpoint for problem solving.
 * Uses vision-capable LLMs for OCR, with runtime multi-model fallback.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { extractFormulas } from '@/lib/recognition/formula-extractor';
import { aggregateRecognitionQuality } from '@/lib/recognition/recognition-quality';
import { isJsonLikeOutput, parseProblemSpecs } from '@/lib/recognition/problem-spec-parser';
import { validateImage } from '@/lib/recognition/image-validator';
import { getModel } from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/ai/providers';
import type { ProviderType } from '@/lib/types/provider';
import type { ProblemSpec } from '@/lib/solve/types';
import { callLLM } from '@/lib/ai/llm';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { jsonrepair } from 'jsonrepair';

const log = createLogger('API:SkySolveRecognize');

const STRUCTURED_OCR_PROMPT = `你是纸质题目与手写内容视觉转录器。只识别和结构化图片内容，绝对不要解题。

只返回 {"problems":[ProblemSpec,...]} JSON 对象，不要输出 JSON 之外内容。
每题必须包含 id、stage、subject、questionType、stem、options、givens、asks、formulas、ambiguities、confidence。
stage 只能是高中、大学、unknown。缺省数组必须返回 []。公式使用 LaTeX。
必须支持中文、英文、数字、单位、手写与印刷混排，以及分式、根式、上下标、向量、积分、求和和矩阵。
多道题分别放入 problems；保留题号、材料、子问题、选项、表格、图形标签与关系。
看不清、被裁剪或存在多种读法时禁止猜测：在 ambiguities 内写 {field,candidates,reason} 并降低 confidence。
confidence 范围 0 到 1。不要解释、评价或提供答案。`;

interface VisionModelConfig {
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  providerType: ProviderType;
  baseUrl?: string;
}

/** Build list of available vision models in priority order (accuracy first for math recognition) */
function getVisionModels(): VisionModelConfig[] {
  const models: VisionModelConfig[] = [];

  const envKeyNames: Partial<Record<ProviderId, string>> = {
    anthropic: 'ANTHROPIC_API_KEY',
    qwen: 'QWEN_API_KEY',
    glm: 'GLM_API_KEY',
    openai: 'OPENAI_API_KEY',
  };

  const addModel = (providerId: ProviderId, modelId: string, providerType: ProviderType) => {
    const envKeyName = envKeyNames[providerId];
    // An explicitly present env var (including an empty value in tests or
    // local overrides) takes precedence over the cached YAML configuration.
    const apiKey =
      envKeyName && Object.prototype.hasOwnProperty.call(process.env, envKeyName)
        ? process.env[envKeyName] || ''
        : resolveApiKey(providerId);
    if (!apiKey) return;
    models.push({
      providerId,
      modelId,
      apiKey,
      providerType,
      baseUrl:
        envKeyName &&
        Object.prototype.hasOwnProperty.call(
          process.env,
          `${envKeyName.replace(/_API_KEY$/, '')}_BASE_URL`,
        )
          ? process.env[`${envKeyName.replace(/_API_KEY$/, '')}_BASE_URL`] || undefined
          : resolveBaseUrl(providerId),
    });
  };

  // qwen3-vl-plus is the primary model for Chinese/math recognition. The OCR
  // specialist qwen-vl-ocr-latest cannot follow the structured ProblemSpec
  // prompt (it returns stem/options in its own incompatible schema), so it is
  // deliberately not listed.
  addModel('qwen' as ProviderId, 'qwen3-vl-plus', 'openai' as ProviderType);
  // Claude and GLM remain available as fallbacks.
  addModel('anthropic' as ProviderId, 'claude-sonnet-4-6', 'anthropic' as ProviderType);
  addModel('glm' as ProviderId, 'glm-5v-turbo', 'openai' as ProviderType);
  // OpenAI is a broadly available final fallback for deployments that only
  // configure the default OpenAI provider.
  addModel('openai' as ProviderId, 'gpt-4o-mini', 'openai' as ProviderType);

  return models;
}

/** Accept OCR providers that wrap their plain transcription in a JSON object. */
function extractWrappedOcrText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const findText = (value: unknown): string | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if ('problems' in record) return null;
    for (const key of ['text', 'output_text', 'markdown', 'ocr_text']) {
      if (typeof record[key] === 'string' && record[key].trim()) return record[key];
    }
    return findText(record.data);
  };

  return findText(parsed);
}

/** Normalize model-returned givens into schema-valid ProblemGiven objects. */
function normalizeGivens(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [{ name: item }] : [];
    if (!item || typeof item !== 'object') return [];
    const given: Record<string, string> = {};
    for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
      if (val == null) continue;
      given[key] = typeof val === 'string' ? val : String(val);
    }
    return Object.keys(given).length > 0 ? [given] : [];
  });
}

/** Keep only ambiguities matching {field, candidates: string[], reason}. */
function normalizeAmbiguities(
  value: unknown,
): { field: string; candidates: string[]; reason: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is { field: string; candidates: string[]; reason: string } =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).field === 'string' &&
      Array.isArray((item as Record<string, unknown>).candidates) &&
      ((item as Record<string, unknown>).candidates as unknown[]).every(
        (c) => typeof c === 'string',
      ) &&
      typeof (item as Record<string, unknown>).reason === 'string',
  );
}

/** Keep diagrams that match ProblemDiagram; drop anything else. */
function normalizeDiagram(value: unknown): {
  type: string;
  description: string;
  labels: string[];
  relations: string[];
} | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Record<string, unknown>;
  if (typeof d.type !== 'string' || typeof d.description !== 'string') return null;
  const toStringArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  return {
    type: d.type,
    description: d.description,
    labels: toStringArray(d.labels),
    relations: toStringArray(d.relations),
  };
}

/** Normalize partially structured OCR JSON without inventing the question stem. */
function parseRelaxedProblemSpecs(raw: string): ProblemSpec[] {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const json = (fenced ?? (start >= 0 && end >= start ? raw.slice(start, end + 1) : '')).trim();
    if (!json) return [];
    const parsed = JSON.parse(jsonrepair(json)) as { problems?: unknown };
    if (!Array.isArray(parsed.problems)) return [];

    return parsed.problems.flatMap((value, index) => {
      if (!value || typeof value !== 'object') return [];
      const problem = value as Record<string, unknown>;
      const stem = typeof problem.stem === 'string' ? problem.stem.trim() : '';
      if (!stem) return [];
      // Models return options either as {key, content} objects or as plain
      // strings like "A. xxx" — normalize both into key/content pairs instead
      // of dropping them, so choice questions keep their options end-to-end.
      const options = Array.isArray(problem.options)
        ? problem.options.flatMap((option): { key: string; content: string }[] => {
            if (option && typeof option === 'object') {
              const key = (option as Record<string, unknown>).key;
              const content = (option as Record<string, unknown>).content;
              if (
                typeof key === 'string' &&
                key.trim() &&
                typeof content === 'string' &&
                content.trim()
              ) {
                return [{ key: key.trim(), content: content.trim() }];
              }
              return [];
            }
            if (typeof option === 'string') {
              const match = option.trim().match(/^([A-Za-z]{1,2}|\d{1,2})\s*[.、:：）)]\s*(.+)$/);
              if (match) return [{ key: match[1], content: match[2].trim() }];
              return [];
            }
            return [];
          })
        : [];
      const stringArray = (field: string) =>
        Array.isArray(problem[field])
          ? (problem[field] as unknown[]).filter((item): item is string => typeof item === 'string')
          : [];
      return [
        {
          id: typeof problem.id === 'string' && problem.id.trim() ? problem.id : String(index + 1),
          stage:
            problem.stage === '初中' || problem.stage === '高中' || problem.stage === '大学'
              ? problem.stage
              : 'unknown',
          subject:
            typeof problem.subject === 'string' && problem.subject.trim()
              ? problem.subject
              : 'unknown',
          questionType:
            typeof problem.questionType === 'string' && problem.questionType.trim()
              ? problem.questionType
              : 'unknown',
          stem,
          options,
          givens: normalizeGivens(problem.givens),
          asks: stringArray('asks'),
          formulas: stringArray('formulas'),
          ambiguities: normalizeAmbiguities(problem.ambiguities),
          materials: stringArray('materials'),
          subQuestions: stringArray('subQuestions'),
          diagram: normalizeDiagram(problem.diagram),
          confidence:
            typeof problem.confidence === 'number' && Number.isFinite(problem.confidence)
              ? Math.min(1, Math.max(0, problem.confidence))
              : 0.5,
        } as ProblemSpec,
      ];
    });
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;

    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: image');
    }

    const validation = validateImage(image);
    if (!validation.valid) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, validation.error ?? '图片校验失败');
    }

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = image.type || 'image/png';

    const visionModels = getVisionModels();
    log.info(
      `[Recognize] Available vision models: ${visionModels.map((m) => `${m.providerId}/${m.modelId}`).join(', ')}, image: ${bytes.byteLength} bytes, ${mimeType}`,
    );

    if (visionModels.length === 0) {
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        '没有配置支持视觉的模型，请配置 OPENAI_API_KEY、ANTHROPIC_API_KEY、GLM_API_KEY 或 QWEN_API_KEY',
      );
    }

    // Build vision message content.
    // For OpenAI-compatible providers (Qwen, GLM), images must be sent as
    // data-URL strings rather than raw Buffer, because their compatible-mode
    // endpoints do not handle binary image parts.
    const base64DataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, image: base64DataUrl },
          {
            type: 'text' as const,
            text: '请逐字逐句识别纸质图片中的所有印刷与手写内容。保留原有顺序、题号、换行、中文、英文、数字和单位；分式、根式、上下标、向量、积分、求和、矩阵等公式必须用 LaTeX 并用 $...$ 包裹。无法确定的字符不要猜测，记录到 ambiguities 并降低 confidence。',
          },
        ],
      },
    ] as any;

    const errors: string[] = [];
    let sawEmptyProblems = false;

    // Try each vision model in sequence — first success wins
    for (const visionConfig of visionModels) {
      try {
        const modelWithInfo = getModel(visionConfig);

        log.info(`[Recognize] Trying ${visionConfig.providerId}/${visionConfig.modelId}...`);

        const result = await callLLM(
          {
            model: modelWithInfo.model,
            messages,
            temperature: 0.1,
            maxOutputTokens: 4096,
            // SDK-level retries add 3×10s connect timeouts on unreachable
            // endpoints; the model-level fallback below handles retries.
            maxRetries: 0,
          },
          'ocr-recognize',
          { retries: 0 }, // model-level fallback handles retries
          undefined, // thinking
          STRUCTURED_OCR_PROMPT,
        );

        const rawText = result.text || '';
        if (!rawText.trim()) {
          log.warn(
            `[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} returned empty text`,
          );
          errors.push(`${visionConfig.providerId}/${visionConfig.modelId}: 返回空白内容`);
          continue;
        }

        const wrappedOcrText = extractWrappedOcrText(rawText);
        const { text: cleanedText, latex } = extractFormulas(wrappedOcrText ?? rawText);

        let structuredProblems = [] as ReturnType<typeof parseProblemSpecs>;
        try {
          structuredProblems = parseProblemSpecs(rawText);
        } catch (parseError) {
          log.warn(
            `[Recognize] Structured ProblemSpec parse failed; using legacy OCR: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
          log.warn(
            `[Recognize] Raw model output preview: ${rawText.slice(0, 800).replace(/\s+/g, ' ')}`,
          );
          structuredProblems = parseRelaxedProblemSpecs(rawText);
          if (isJsonLikeOutput(rawText) && !wrappedOcrText && structuredProblems.length === 0) {
            errors.push(
              `${visionConfig.providerId}/${visionConfig.modelId}: invalid ProblemSpec JSON`,
            );
            continue;
          }
          // Legacy vision models return plain OCR text; preserve old response shape.
        }

        if (structuredProblems.length > 0) {
          const quality = aggregateRecognitionQuality(structuredProblems);
          const structuredText = structuredProblems
            .map((problem) =>
              [
                problem.stem,
                ...problem.options.map((option) => `${option.key}. ${option.content}`),
              ].join('\n'),
            )
            .join('\n\n');
          const structuredLatex = extractFormulas(structuredText).latex;
          await recordUsage(quota.userId, quota.planType, 'llmCalls');
          return apiSuccess({
            text: structuredText,
            latex: structuredLatex,
            problemCount: structuredProblems.length,
            problems: structuredProblems.map((problem) => ({
              image: base64DataUrl,
              text: problem.stem,
              latex: extractFormulas(problem.stem).latex,
            })),
            structuredProblems,
            confidence: quality.confidence,
            ambiguities: quality.ambiguities,
            needsConfirmation: quality.needsConfirmation,
            usedModel: `${visionConfig.providerId}/${visionConfig.modelId}`,
          });
        }
        if (isJsonLikeOutput(rawText) && !wrappedOcrText) {
          // Model responded fine but found no problem in the image — remember
          // this so we can return a clearer message than "all models failed".
          sawEmptyProblems = true;
          errors.push(
            `${visionConfig.providerId}/${visionConfig.modelId}: empty ProblemSpec problems array`,
          );
          continue;
        }

        log.info(
          `[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} OK, text length=${cleanedText.length}`,
        );

        const fallbackConfidence = cleanedText.includes('[?]') ? 0.5 : 0.82;
        const quality = aggregateRecognitionQuality([], fallbackConfidence);

        await recordUsage(quota.userId, quota.planType, 'llmCalls');
        return apiSuccess({
          text: cleanedText,
          latex,
          problemCount: cleanedText ? 1 : 0,
          problems: cleanedText ? [{ image: base64DataUrl, text: cleanedText, latex }] : [],
          structuredProblems: [],
          confidence: quality.confidence,
          ambiguities: quality.ambiguities,
          needsConfirmation: quality.needsConfirmation,
          usedModel: `${visionConfig.providerId}/${visionConfig.modelId}`,
        });
      } catch (llmErr) {
        const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
        log.warn(`[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} failed: ${msg}`);
        errors.push(`${visionConfig.providerId}/${visionConfig.modelId}: ${msg}`);
      }
    }

    if (sawEmptyProblems) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        422,
        '图片中未识别到题目内容，请确认照片清晰且完整包含题目后重试',
      );
    }

    log.error(`[Recognize] All ${visionModels.length} vision models failed: ${errors.join('; ')}`);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      `所有视觉模型均识别失败（已尝试 ${visionModels.length} 个模型）`,
      errors.join('; '),
    );
  } catch (err) {
    log.error('Recognize API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '图片识别失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
