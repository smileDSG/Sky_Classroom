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

const OCR_PROMPT = `你是一个专业的数学题目识别助手。请仔细识别图片中的所有题目内容。

要求：
1. 逐题识别，保留题目编号（如 1.、①、(1) 等）
2. 数学公式和符号用 LaTeX 格式输出：分数用 \\frac{}{}、根号用 \\sqrt{}、上下标用 ^ 和 _
3. 纯文字部分保持中文原文
4. 如果图片中有多道题，每道题之间用空行分隔
5. 无法看清的内容用 [?] 标记，不要猜测
6. 只输出识别到的题目文字和公式，不要添加你的解释、评价或问候语`;

interface VisionModelConfig {
  providerId: ProviderId;
  modelId: string;
  apiKey: string;
  providerType: ProviderType;
}

/** Build list of available vision models in priority order (fast/cheap first) */
function getVisionModels(): VisionModelConfig[] {
  const models: VisionModelConfig[] = [];

  if (process.env.GLM_API_KEY) {
    models.push({
      providerId: 'glm' as ProviderId,
      modelId: 'glm-5v-turbo',
      apiKey: process.env.GLM_API_KEY,
      providerType: 'openai' as ProviderType,
    });
  }
  if (process.env.QWEN_API_KEY) {
    models.push({
      providerId: 'qwen' as ProviderId,
      modelId: 'qwen3-vl-plus',
      apiKey: process.env.QWEN_API_KEY,
      providerType: 'openai' as ProviderType,
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    models.push({
      providerId: 'anthropic' as ProviderId,
      modelId: 'claude-sonnet-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      providerType: 'anthropic' as ProviderType,
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
          { type: 'text' as const, text: '请识别图片中的数学题目内容。' },
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
            messages: messages as any,
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
          'ocr-recognize',
          { retries: 0 },  // model-level fallback handles retries
          undefined,         // thinking
          OCR_PROMPT,
        );

        const rawText = result.text || '';
        if (!rawText.trim()) {
          log.warn(`[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} returned empty text`);
          errors.push(`${visionConfig.providerId}/${visionConfig.modelId}: 返回空白内容`);
          continue;
        }

        const { text: cleanedText, latex } = extractFormulas(rawText);

        log.info(`[Recognize] ${visionConfig.providerId}/${visionConfig.modelId} OK, text length=${cleanedText.length}`);

        const base64ForResponse = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64ForResponse}`;

        return apiSuccess({
          text: cleanedText,
          latex,
          problemCount: cleanedText ? 1 : 0,
          problems: cleanedText ? [{ image: dataUrl, text: cleanedText, latex }] : [],
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
