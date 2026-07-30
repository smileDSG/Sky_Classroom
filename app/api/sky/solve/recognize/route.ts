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
import { callLLM } from '@/lib/ai/llm';

const log = createLogger('API:SkySolveRecognize');

const STRUCTURED_OCR_PROMPT = `你是纸质题目与手写内容视觉转录器。只识别和结构化图片内容，绝对不要解题。

只返回 {"problems":[ProblemSpec,...]} JSON 对象，不要输出 JSON 之外内容。
每题必须包含 id、stage、subject、questionType、stem、options、givens、asks、formulas、ambiguities、confidence。
stage 只能是初中、高中、大学、unknown。缺省数组必须返回 []。公式使用 LaTeX。
必须支持中文、英文、数字、单位、手写与印刷混排，以及分式、根式、上下标、向量、积分、求和和矩阵。
多道题分别放入 problems；保留题号、材料、子问题、选项、表格、图形标签与关系。
看不清、被裁剪或存在多种读法时禁止猜测：在 ambiguities 内写 {field,candidates,reason} 并降低 confidence。
confidence 范围 0 到 1。不要解释、评价或提供答案。`;

interface VisionModelConfig {
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  providerType: ProviderType;
}

/** Build list of available vision models in priority order (accuracy first for math recognition) */
function getVisionModels(): VisionModelConfig[] {
  const models: VisionModelConfig[] = [];

  // Claude first — best at math formula recognition in images
  if (process.env.ANTHROPIC_API_KEY) {
    models.push({
      providerId: 'anthropic' as ProviderId,
      modelId: 'claude-sonnet-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      providerType: 'anthropic' as ProviderType,
    });
  }
  // Qwen3-VL-Plus — strong multimodal with good math support
  if (process.env.QWEN_API_KEY) {
    models.push({
      providerId: 'qwen' as ProviderId,
      modelId: 'qwen3-vl-plus',
      apiKey: process.env.QWEN_API_KEY,
      providerType: 'openai' as ProviderType,
    });
  }
  // GLM-5V-turbo — fallback option
  if (process.env.GLM_API_KEY) {
    models.push({
      providerId: 'glm' as ProviderId,
      modelId: 'glm-5v-turbo',
      apiKey: process.env.GLM_API_KEY,
      providerType: 'openai' as ProviderType,
    });
  }

  return models;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: image',
      );
    }

    const validation = validateImage(image);
    if (!validation.valid) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        validation.error ?? '图片校验失败',
      );
    }

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = image.type || 'image/png';

    const visionModels = getVisionModels();
    log.info(`[Recognize] Available vision models: ${visionModels.map(m => `${m.providerId}/${m.modelId}`).join(', ')}, image: ${bytes.byteLength} bytes, ${mimeType}`);

    if (visionModels.length === 0) {
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        '没有配置支持视觉的模型，请配置 ANTHROPIC_API_KEY 或 GLM_API_KEY 或 QWEN_API_KEY',
      );
    }

    // Build vision message content.
    // For OpenAI-compatible providers (Qwen, GLM), images must be sent as
    // data-URL strings rather than raw Buffer, because their compatible-mode
    // endpoints do not handle binary image parts.
    const base64DataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const messages: Parameters<typeof callLLM>[0]['messages'] = [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, image: base64DataUrl },
          { type: 'text' as const, text: '请逐字逐句识别纸质图片中的所有印刷与手写内容。保留原有顺序、题号、换行、中文、英文、数字和单位；分式、根式、上下标、向量、积分、求和、矩阵等公式必须用 LaTeX 并用 $...$ 包裹。无法确定的字符不要猜测，记录到 ambiguities 并降低 confidence。' },
        ],
      },
    ];

    const errors: string[] = [];

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
          },
          'ocr-recognize',
          { retries: 0 },  // model-level fallback handles retries
          undefined,         // thinking
          STRUCTURED_OCR_PROMPT,
        );

        const rawText = result.text || '';
        if (!rawText.trim()) {
          log.warn(`[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} returned empty text`);
          errors.push(`${visionConfig.providerId}/${visionConfig.modelId}: 返回空白内容`);
          continue;
        }

        const { text: cleanedText, latex } = extractFormulas(rawText);

        let structuredProblems = [] as ReturnType<typeof parseProblemSpecs>;
        try {
          structuredProblems = parseProblemSpecs(rawText);
        } catch (parseError) {
          log.warn(`[Recognize] Structured ProblemSpec parse failed; using legacy OCR: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          if (isJsonLikeOutput(rawText)) {
            errors.push(`${visionConfig.providerId}/${visionConfig.modelId}: invalid ProblemSpec JSON`);
            continue;
          }
          // Legacy vision models return plain OCR text; preserve old response shape.
        }

        if (structuredProblems.length > 0) {
          const quality = aggregateRecognitionQuality(structuredProblems);
          const structuredText = structuredProblems
            .map(problem => [problem.stem, ...problem.options.map(option => `${option.key}. ${option.content}`)].join('\n'))
            .join('\n\n');
          const structuredLatex = extractFormulas(structuredText).latex;
          return apiSuccess({
            text: structuredText,
            latex: structuredLatex,
            problemCount: structuredProblems.length,
            problems: structuredProblems.map(problem => ({ image: base64DataUrl, text: problem.stem, latex: extractFormulas(problem.stem).latex })),
            structuredProblems,
            confidence: quality.confidence,
            ambiguities: quality.ambiguities,
            needsConfirmation: quality.needsConfirmation,
            usedModel: `${visionConfig.providerId}/${visionConfig.modelId}`,
          });
        }
        if (isJsonLikeOutput(rawText)) {
          errors.push(`${visionConfig.providerId}/${visionConfig.modelId}: empty ProblemSpec problems array`);
          continue;
        }

        log.info(`[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} OK, text length=${cleanedText.length}`);

        const fallbackConfidence = cleanedText.includes('[?]') ? 0.5 : 0.82;
        const quality = aggregateRecognitionQuality([], fallbackConfidence);

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
