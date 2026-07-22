/**
 * POST /api/sky/solve/recognize
 * Recognize printed or handwritten problem photos for the existing solve flow.
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

const OCR_PROMPT = `你是纸质题目与手写内容视觉转录器，只识别和结构化图片内容，绝对不要解题。
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

function getVisionModels(): VisionModelConfig[] {
  const models: VisionModelConfig[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    models.push({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      providerType: 'anthropic',
    });
  }
  if (process.env.QWEN_API_KEY) {
    models.push({
      providerId: 'qwen',
      modelId: 'qwen3-vl-plus',
      apiKey: process.env.QWEN_API_KEY,
      providerType: 'openai',
    });
  }
  if (process.env.GLM_API_KEY) {
    models.push({
      providerId: 'glm',
      modelId: 'glm-5v-turbo',
      apiKey: process.env.GLM_API_KEY,
      providerType: 'openai',
    });
  }
  return models;
}

export async function POST(req: Request) {
  try {
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
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const visionModels = getVisionModels();

    log.info(
      `[Recognize] models=${visionModels.map((m) => `${m.providerId}/${m.modelId}`).join(', ')}, bytes=${bytes.byteLength}`,
    );
    if (visionModels.length === 0) {
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        '没有配置支持视觉的模型，请配置 ANTHROPIC_API_KEY、GLM_API_KEY 或 QWEN_API_KEY',
      );
    }

    const messages: Parameters<typeof callLLM>[0]['messages'] = [
      {
        role: 'user',
        content: [
          { type: 'image', image: dataUrl },
          {
            type: 'text',
            text: '请逐字逐句识别图片中的所有文字和数学公式，特别注意手写字、分数、根式、上下标、向量和单位。',
          },
        ],
      },
    ];

    const modelPromises = visionModels.map(async (visionConfig) => {
      const modelWithInfo = getModel(visionConfig);
      log.info(`[Recognize] racing ${visionConfig.providerId}/${visionConfig.modelId}`);
      const llmPromise = callLLM(
        { model: modelWithInfo.model, messages, temperature: 0.1, maxOutputTokens: 8192 },
        'ocr-recognize',
        { retries: 0 },
        undefined,
        OCR_PROMPT,
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `${visionConfig.providerId}/${visionConfig.modelId} timed out after 25000ms`,
              ),
            ),
          25_000,
        );
      });
      const result = await Promise.race([llmPromise, timeoutPromise]);
      const rawText = result.text?.trim() ?? '';
      if (!rawText)
        throw new Error(`${visionConfig.providerId}/${visionConfig.modelId}: 返回空白内容`);

      const { text: cleanedText, latex } = extractFormulas(rawText);
      let structuredProblems: ReturnType<typeof parseProblemSpecs> = [];
      try {
        structuredProblems = parseProblemSpecs(rawText);
      } catch (parseError) {
        log.warn(
          `[Recognize] structured parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
        if (isJsonLikeOutput(rawText))
          throw new Error(
            `${visionConfig.providerId}/${visionConfig.modelId}: invalid ProblemSpec JSON`,
          );
      }
      if (isJsonLikeOutput(rawText) && structuredProblems.length === 0) {
        throw new Error(
          `${visionConfig.providerId}/${visionConfig.modelId}: empty ProblemSpec problems array`,
        );
      }
      return { visionConfig, rawText, cleanedText, latex, structuredProblems };
    });

    try {
      const winner = await Promise.any(modelPromises);
      const structuredText = winner.structuredProblems
        .map((problem) =>
          [
            problem.stem,
            ...problem.options.map((option) => `${option.key}. ${option.content}`),
          ].join('\n'),
        )
        .join('\n\n');
      // Keep the original legacy OCR text so inline/display LaTeX remains part
      // of the problem sent to the solver; `latex` is an extracted index only.
      const text = winner.structuredProblems.length > 0 ? structuredText : winner.rawText;
      const latex =
        winner.structuredProblems.length > 0 ? extractFormulas(structuredText).latex : winner.latex;
      const fallbackConfidence = text.includes('[?]') ? 0.5 : 0.82;
      const quality = aggregateRecognitionQuality(winner.structuredProblems, fallbackConfidence);
      return apiSuccess({
        text,
        latex,
        problemCount:
          winner.structuredProblems.length > 0 ? winner.structuredProblems.length : text ? 1 : 0,
        problems:
          winner.structuredProblems.length > 0
            ? winner.structuredProblems.map((problem) => ({
                image: dataUrl,
                text: problem.stem,
                latex: extractFormulas(problem.stem).latex,
              }))
            : text
              ? [{ image: dataUrl, text, latex }]
              : [],
        structuredProblems: winner.structuredProblems,
        confidence: quality.confidence,
        ambiguities: quality.ambiguities,
        needsConfirmation: quality.needsConfirmation,
        usedModel: `${winner.visionConfig.providerId}/${winner.visionConfig.modelId}`,
      });
    } catch (aggErr) {
      const errors = (aggErr as AggregateError).errors?.map((error: unknown) =>
        error instanceof Error ? error.message : String(error),
      ) ?? [String(aggErr)];
      log.error(`[Recognize] all vision models failed: ${errors.join('; ')}`);
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        `所有视觉模型均识别失败（已尝试 ${visionModels.length} 个模型）`,
        errors.join('; '),
      );
    }
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
