/**
 * POST /api/sky/solve/recognize
 * Image recognition endpoint for problem solving.
 * Uses a vision-capable LLM for OCR, with multi-provider fallback.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { extractFormulas } from '@/lib/recognition/formula-extractor';
import { getModel } from '@/lib/ai/providers';
import { callLLM } from '@/lib/ai/llm';

const log = createLogger('API:SkySolveRecognize');

const OCR_PROMPT = `你是一个专业的数学题目识别助手。请仔细识别图片中的所有题目内容。

要求：
1. 准确识别题目编号和题目内容
2. 保留数学公式的原始格式
3. 如果有 LaTeX 公式请尽量用 LaTeX 格式输出
4. 如果无法看清的内容用 [?] 标记
5. 只输出识别到的文本内容，不要添加任何解释`;

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

    // Convert to base64 for vision model
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const mimeType = image.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const visionConfig = getVisionModel();
    log.info(`[Recognize] Using vision provider: ${visionConfig?.providerId}, model: ${visionConfig?.modelId}, apiKey present: ${!!visionConfig?.apiKey}`);

    if (!visionConfig) {
      return apiError(
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
        '没有配置支持视觉的模型，请配置 ANTHROPIC_API_KEY 或 GLM_API_KEY 或 QWEN_API_KEY',
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
        '模型初始化失败',
        modelErr instanceof Error ? modelErr.message : undefined,
      );
    }

    let messages: Array<{ role: string; content: unknown }>;
    let systemPrompt: string | undefined;

    if (visionConfig.providerId === 'anthropic') {
      // AI SDK Anthropic adapter: system as separate param, image as data URL
      systemPrompt = OCR_PROMPT;
      messages = [
        {
          role: 'user',
          content: [
            { type: 'image', image: dataUrl },
            { type: 'text', text: '请识别图片中的数学题目内容。' },
          ],
        },
      ];
    } else {
      // OpenAI-compatible (GLM, Qwen, etc.): pass system as top-level param
      systemPrompt = OCR_PROMPT;
      messages = [
        {
          role: 'user',
          content: [
            { type: 'image', image: dataUrl },
            { type: 'text', text: '请识别图片中的数学题目内容。' },
          ],
        },
      ];
    }

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
      '图片识别失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
