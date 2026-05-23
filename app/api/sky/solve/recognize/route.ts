/**
 * POST /api/sky/solve/recognize
 * Image recognition endpoint for problem solving.
 * Uses a vision-capable LLM for OCR, with multi-provider fallback.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerTranslation } from '@/lib/server/i18n';
import { createLogger } from '@/lib/logger';
import { extractFormulas } from '@/lib/recognition/formula-extractor';
import { validateImage } from '@/lib/recognition/image-validator';
import { getModel } from '@/lib/ai/providers';
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

/** Build vision model config: GLM first (faster), then Qwen, then Anthropic */
function getVisionModel() {
  // 1. GLM-5V-Turbo — fast vision model
  if (process.env.GLM_API_KEY) {
    return { providerId: 'glm' as const, modelId: 'glm-5v-turbo', apiKey: process.env.GLM_API_KEY, providerType: 'openai' as const };
  }
  // 2. Qwen VL
  if (process.env.QWEN_API_KEY) {
    return { providerId: 'qwen' as const, modelId: 'qwen3-vl-plus', apiKey: process.env.QWEN_API_KEY, providerType: 'openai' as const };
  }
  // 3. Anthropic Claude — fallback
  if (process.env.ANTHROPIC_API_KEY) {
    return { providerId: 'anthropic' as const, modelId: 'claude-sonnet-4-6', apiKey: process.env.ANTHROPIC_API_KEY, providerType: 'anthropic' as const };
  }
  return null;
}

export async function POST(req: Request) {
  const locale = req.headers.get('X-Locale') || 'zh-CN';
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
        validation.error ?? getServerTranslation(locale, 'api.validationFailed'),
      );
    }

    // Keep raw bytes — AI SDK handles base64 encoding internally.
    // Passing a data URL would cause double-encoding (AI SDK re-encodes
    // the string as base64), which produces garbled image data.
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = image.type || 'image/png';

    const visionConfig = getVisionModel();
    log.info(`[Recognize] Using vision provider: ${visionConfig?.providerId}, model: ${visionConfig?.modelId}, apiKey present: ${!!visionConfig?.apiKey}`);

    if (!visionConfig) {
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        getServerTranslation(locale, 'api.noVisionModel'),
      );
    }

    log.info(`[Recognize] Image size: ${bytes.byteLength} bytes, mimeType: ${mimeType}`);

    let modelWithInfo;
    try {
      modelWithInfo = getModel(visionConfig);
    } catch (modelErr) {
      log.error('[Recognize] getModel failed:', modelErr);
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        getServerTranslation(locale, 'api.modelInitFailed'),
        modelErr instanceof Error ? modelErr.message : undefined,
      );
    }

    // Pass raw buffer — AI SDK core converts it to FilePart, then the
    // provider adapter base64-encodes it once. Passing a data URL string
    // would be re-encoded (double base64), producing garbled data.
    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, image: buffer, mimeType },
          { type: 'text' as const, text: '请识别图片中的数学题目内容。' },
        ],
      },
    ];
    const systemPrompt = OCR_PROMPT;

    log.info(`[Recognize] Calling LLM with provider=${visionConfig.providerId}, model=${visionConfig.modelId}`);

    let result;
    try {
      result = await callLLM(
        {
          model: modelWithInfo.model,
          messages: messages as any,
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
        'ocr-recognize',
        { retries: 1 },
        undefined,  // thinking
        systemPrompt,
      );
    } catch (llmErr) {
      log.error('[Recognize] LLM call failed:', llmErr);
      throw llmErr;
    }

    const rawText = result.text || '';
    const { text: cleanedText, latex } = extractFormulas(rawText);

    log.info(`[Recognize] OCR complete, text length=${cleanedText.length}`);

    // Build data URL for response (display only — not sent to LLM)
    const base64ForResponse = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64ForResponse}`;

    return apiSuccess({
      text: cleanedText,
      latex,
      problemCount: cleanedText ? 1 : 0,
      problems: cleanedText ? [{ image: dataUrl, text: cleanedText, latex }] : [],
    });
  } catch (err) {
    log.error('Recognize API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      getServerTranslation(locale, 'api.generateFailed'),
      err instanceof Error ? err.message : undefined,
    );
  }
}
