/**
 * POST /api/sky/slides/infer-template
 * AI-driven template recommendation based on topic semantics.
 */
import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { inferTemplateByTopic, TEMPLATE_PACKS } from '@/lib/slides/template-packs';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:InferTemplate');

const SYSTEM_PROMPT = `你是一位教学设计专家。请根据用户提供的教学主题，从以下12套PPT模板中选择最合适的一套。

可选模板及适用场景：
- modern-geometric: 现代几何风 — 数学、几何、物理、逻辑、编程等理性学科
- classical: 古典书香风 — 语文、历史、传统文化、书法等古典人文
- cartoon: 明快卡通风 — 小学、科学启蒙、品德教育等活泼低龄场景
- nordic: 简约北欧风 — 学习方法、通识、心理学、英语等清新简约
- business: 商务专业风 — 商科、职业培训、管理等职场场景
- sports: 活力运动风 — 体育、健康、生物等活力场景
- ocean: 海洋探索风 — 地理、海洋科学、环境等探索场景
- watercolor: 清新水彩风 — 美术、艺术、色彩等创意场景
- nature: 清新自然风 — 生物、生态、环保、地理等自然场景
- humanistic: 温暖人文风 — 语文、文学、哲学等人文暖调
- vintage: 田园复古风 — 农业、历史、传统文化等复古场景
- tech: 科技未来风 — 信息技术、编程、物理、AI等科技前沿

请只返回一个模板ID，格式必须严格为JSON：
{"templateId": "xxx", "reason": "一句话说明理由"}`;

function buildUserPrompt(topic: string): string {
  return `教学主题："${topic}"

请根据主题内容判断最合适的PPT模板风格，只返回JSON。`;
}

function parseTemplateId(text: string): { templateId: string; reason: string } | null {
  const trimmed = text.trim();

  // Try JSON parse first
  try {
    const json = JSON.parse(trimmed);
    if (json.templateId && typeof json.templateId === 'string') {
      return {
        templateId: json.templateId.trim(),
        reason: json.reason ?? '',
      };
    }
  } catch {
    // Not valid JSON, try regex extraction
  }

  // Fallback: extract templateId from text patterns
  const idMatch = trimmed.match(/["']?templateId["']?\s*[:=]\s*["']?([a-z-]+)["']?/i);
  if (idMatch) {
    return { templateId: idMatch[1], reason: '' };
  }

  // Last resort: look for any known template ID in the text
  const lower = trimmed.toLowerCase();
  for (const tp of TEMPLATE_PACKS) {
    if (lower.includes(tp.id.toLowerCase())) {
      return { templateId: tp.id, reason: '' };
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic } = body as { topic?: string };

    if (!topic || !topic.trim()) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required field: topic');
    }

    // Resolve model (same pattern as generate route)
    const { model: languageModel, modelInfo, modelString } = await resolveModelFromRequest(req, body);

    log.info(`Inferring template for "${topic}" [model=${modelString}]`);

    const userPrompt = buildUserPrompt(topic);

    const llmResult = await callLLM(
      {
        model: languageModel,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 256,
      },
      'sky-slides-infer-template',
      {
        retries: 1,
        validate: (text) => text.trim().length > 5,
      },
    );

    const parsed = parseTemplateId(llmResult.text);

    if (parsed) {
      // Validate that the returned ID exists
      const exists = TEMPLATE_PACKS.some((t) => t.id === parsed.templateId);
      if (exists) {
        log.info(`AI inferred template: ${parsed.templateId} for "${topic}"`);
        return apiSuccess({
          templateId: parsed.templateId,
          reason: parsed.reason,
          source: 'ai',
        });
      }
    }

    // Fallback to keyword-based matching
    const fallbackId = inferTemplateByTopic(topic);
    log.warn(`AI inference failed or returned invalid ID, fallback to keyword: ${fallbackId}`);
    return apiSuccess({
      templateId: fallbackId,
      reason: '基于关键词匹配',
      source: 'fallback',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Template inference failed:', err);

    // Graceful fallback even on total failure
    try {
      const body = await req.clone().json();
      const fallbackId = inferTemplateByTopic(body.topic ?? '');
      return apiSuccess({
        templateId: fallbackId,
        reason: '推断服务异常，使用默认推荐',
        source: 'fallback',
      });
    } catch {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '模板推断失败', msg);
    }
  }
}
