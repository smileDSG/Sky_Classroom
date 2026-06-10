/**
 * POST /api/sky/solve/recognize
 * Image recognition endpoint for problem solving.
 * Uses vision-capable LLMs for OCR, with runtime multi-model fallback.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { extractFormulas } from '@/lib/recognition/formula-extractor';
import { validateImage } from '@/lib/recognition/image-validator';
import { getModel } from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/ai/providers';
import type { ProviderType } from '@/lib/types/provider';
import { callLLM } from '@/lib/ai/llm';

const log = createLogger('API:SkySolveRecognize');

const OCR_PROMPT = `你是一个专业的数学题目识别助手。请逐字逐句识别图片中的所有内容。

要求：
1. 完整识别图片中的所有文字，不要遗漏任何一行
2. 保留题目编号（如 1.、①、(1) 等）
3. 所有数学公式和符号必须用 LaTeX 格式，用 $...$ 包裹行内公式，$$...$$ 包裹独立公式
4. 分数用 \\frac{分子}{分母}，根号用 \\sqrt{}，上下标用 ^ 和 _
5. 纯文字部分保持中文原文
6. 多道题之间用空行分隔
7. 无法看清的内容用 [?] 标记，不要猜测
8. 只输出识别到的题目文字和公式，不要添加解释或问候语`;

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

    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, image: buffer, mimeType },
          { type: 'text' as const, text: '请识别这张图片中的所有题目内容，包括文字和数学公式。' },
        ],
      },
    ];

    const MODEL_TIMEOUT = 25_000; // 25s per model — complex math images need more time

    // Race all vision models in parallel — first success wins
    const modelPromises = visionModels.map(async (visionConfig) => {
      const modelWithInfo = getModel(visionConfig);
      log.info(`[Recognize] Racing ${visionConfig.providerId}/${visionConfig.modelId}...`);

      const llmPromise = callLLM(
        {
          model: modelWithInfo.model,
          messages: messages as any,
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
        'ocr-recognize',
        { retries: 0 },
        undefined,
        OCR_PROMPT,
      );

      // Wrap with per-model timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${visionConfig.providerId}/${visionConfig.modelId} timed out after ${MODEL_TIMEOUT}ms`)), MODEL_TIMEOUT);
      });

      const result = await Promise.race([llmPromise, timeoutPromise]);
      const rawText = result.text || '';

      if (!rawText.trim()) {
        throw new Error(`${visionConfig.providerId}/${visionConfig.modelId}: 返回空白内容`);
      }

      const { text: cleanedText, latex } = extractFormulas(rawText);
      log.info(`[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} OK, text length=${cleanedText.length}`);

      return { visionConfig, cleanedText, latex };
    });

    try {
      const winner = await Promise.any(modelPromises);
      const base64ForResponse = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64ForResponse}`;

      return apiSuccess({
        text: winner.cleanedText,
        latex: winner.latex,
        problemCount: winner.cleanedText ? 1 : 0,
        problems: winner.cleanedText ? [{ image: dataUrl, text: winner.cleanedText, latex: winner.latex }] : [],
        usedModel: `${winner.visionConfig.providerId}/${winner.visionConfig.modelId}`,
      });
    } catch (aggErr) {
      const errors = (aggErr as AggregateError).errors?.map((e: Error) => e.message) || [String(aggErr)];
      log.error(`[Recognize] All ${visionModels.length} vision models failed: ${errors.join('; ')}`);
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
