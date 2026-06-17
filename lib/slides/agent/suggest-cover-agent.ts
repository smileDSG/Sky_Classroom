/**
 * Suggest Cover Agent — LLM-driven smart cover recommendation.
 *
 * Inputs: topic + difficulty
 * Outputs: recommended DesignDNA + 3 alternative directions
 *
 * Single LLM call (~5-8s) for style discovery, then render PPTX + PNG.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA, LayoutType } from './design-dna';
import { cleanJsonText } from './content-schemas';
import {
  COLOR_PALETTES,
  FONT_PAIRS,
  ALLOWED_LAYOUT_TYPES,
  ALLOWED_MOTIFS,
  validateDesignDNA,
} from './design-dna';
import { getMotifsForTopic } from './cover-agent';

const log = createLogger('SuggestCoverAgent');

// ── Types ────────────────────────────────────────────────────────────

export interface AlternativeDirection {
  paletteId: string;
  fontId: string;
  layoutType: LayoutType;
  density: 'sparse' | 'moderate' | 'rich';
  mood: string;
  styleName: string;
}

export interface SuggestCoverResult {
  success: boolean;
  designDNA?: DesignDNA;
  alternatives?: AlternativeDirection[];
  error?: string;
}

// ── Prompt Building ──────────────────────────────────────────────────

function getPaletteMood(id: string): string {
  const moodMap: Record<string, string> = {
    'midnight-executive': '商务专业',
    'forest-moss': '自然清新',
    'coral-energy': '活力热情',
    'warm-terracotta': '温暖人文',
    'ocean-gradient': '科技冷静',
    'charcoal-minimal': '极简现代',
    'teal-trust': '可信稳重',
    'berry-cream': '优雅柔和',
    'sage-calm': '平静治愈',
    'cherry-bold': '醒目大胆',
    'classical-chinese': '中式古典',
    'tech-dark-cn': '科技深邃',
  };
  return moodMap[id] || '通用';
}

function buildSystemPrompt(): string {
  const palettes = Object.entries(COLOR_PALETTES)
    .map(([id, p]) => `- ${id}: 封面背景#${p.coverBg}, 强调色#${p.accent}, 氛围${getPaletteMood(id)}`)
    .join('\n');

  const fonts = Object.entries(FONT_PAIRS)
    .map(([id, f]) => `- ${id}: 英文${f.en}, 标题字号${f.headingSize}pt`)
    .join('\n');

  const layouts = ALLOWED_LAYOUT_TYPES.join(', ');

  return `你是一位资深课件视觉设计师。根据教学主题和学段，推荐最适合的PPT封面设计风格。

## 可选配色方案
${palettes}

## 可选字体组合
${fonts}

## 可选布局
${layouts}

## 可选密度
sparse(简约留白), moderate(标准均衡), rich(丰富充实)

## 输出格式
只输出纯JSON，不要任何解释：
{
  "paletteId": "配色方案ID",
  "fontId": "字体组合ID",
  "layoutType": "布局类型",
  "density": "sparse|moderate|rich",
  "mood": "风格情绪描述，如'专业学术''活泼轻快''沉稳大气'等，≤15字",
  "styleName": "风格名称，如'科技暗蓝''清新自然'等，≤12字",
  "bestFor": ["适用学科1", "适用学科2"],
  "alternatives": [
    { "paletteId": "...", "fontId": "...", "layoutType": "...", "density": "...", "mood": "...", "styleName": "..." },
    { "paletteId": "...", "fontId": "...", "layoutType": "...", "density": "...", "mood": "...", "styleName": "..." },
    { "paletteId": "...", "fontId": "...", "layoutType": "...", "density": "...", "mood": "...", "styleName": "..." }
  ]
}`;
}

function buildUserPrompt(topic: string, difficulty: string): string {
  return `主题：${topic}
学段：${difficulty}

请推荐最适合的封面风格，并提供3个不同方向的备选方案。`;
}

// ── JSON Cleanup ────────────────────────────────────────────────────

// ── DesignDNA Assembly ──────────────────────────────────────────────

function buildDesignDNA(
  paletteId: string,
  fontId: string,
  layoutType: LayoutType,
  density: 'sparse' | 'moderate' | 'rich',
  mood: string,
  styleName: string,
  bestFor: string[],
  motif: string,
): DesignDNA {
  const palette = COLOR_PALETTES[paletteId] ?? COLOR_PALETTES['midnight-executive'];
  const fonts = FONT_PAIRS[fontId] ?? FONT_PAIRS['georgia-calibri'];

  const safeMotif = ALLOWED_MOTIFS.includes(motif as typeof ALLOWED_MOTIFS[number])
    ? motif : 'geometric-lines';

  const cardStyle: DesignDNA['components']['cardStyle'] =
    safeMotif === 'chinese-seal' ? 'accent-left-bar' :
    safeMotif === 'ink-wash' ? 'shadow-only' :
    'accent-left-bar';

  const bulletStyle: DesignDNA['components']['bulletStyle'] =
    safeMotif === 'chinese-seal' || safeMotif === 'ink-wash' ? 'chinese-brush' : 'dot';

  const pageNumberStyle: DesignDNA['components']['pageNumberStyle'] =
    safeMotif === 'chinese-seal' ? 'circle-number' : 'number-slash-total';

  const dna: DesignDNA = {
    styleName,
    recommended: true,
    colors: { ...palette },
    fonts: { ...fonts },
    decoration: {
      motif: safeMotif as DesignDNA['decoration']['motif'],
      density,
      cornerWeight: 'top-right',
    },
    components: { cardStyle, bulletStyle, pageNumberStyle },
    layoutType,
    mood,
    bestFor: bestFor.slice(0, 5),
  };

  return validateDesignDNA(dna).designDNA;
}

// ── Public API ───────────────────────────────────────────────────────

export async function suggestCoverStyle(
  topic: string,
  difficulty: string,
  languageModel: LanguageModel,
): Promise<SuggestCoverResult> {
  const startTime = Date.now();
  log.info(`[suggestCoverStyle] start — topic="${topic}" difficulty="${difficulty}"`);

  try {
    const system = buildSystemPrompt();
    const user = buildUserPrompt(topic, difficulty);

    log.info(`[suggestCoverStyle] calling LLM for style recommendation...`);
    const llmStart = Date.now();
    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: 4096, temperature: 0.7 },
      'suggest-cover-agent',
      { retries: 1, timeoutMs: 25000, validate: (text) => text.trim().length > 200 && text.includes('paletteId') },
    );
    const llmDuration = Date.now() - llmStart;
    log.info(`[suggestCoverStyle] LLM done in ${llmDuration}ms, tokens=${(result.usage as Record<string, number> | undefined)?.completionTokens ?? '?'}`);

    const jsonText = cleanJsonText(result.text);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      log.error(`[suggestCoverStyle] JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      return { success: false, error: '风格推荐解析失败' };
    }

    const paletteId = String(parsed.paletteId || 'midnight-executive');
    const fontId = String(parsed.fontId || 'georgia-calibri');
    const layoutType = String(parsed.layoutType || 'hero-left') as LayoutType;
    const density = (parsed.density || 'moderate') as 'sparse' | 'moderate' | 'rich';
    const mood = String(parsed.mood || '专业学术');
    const styleName = String(parsed.styleName || '智能推荐');
    const bestFor = Array.isArray(parsed.bestFor) ? parsed.bestFor.map(String) : [topic.slice(0, 10)];

    // Infer motif from topic (same logic as cover-agent)
    const motifs = getMotifsForTopic(topic);
    const motif = motifs[0] || 'geometric-lines';

    const designDNA = buildDesignDNA(paletteId, fontId, layoutType, density, mood, styleName, bestFor, motif);

    log.info(`[suggestCoverStyle] recommended: palette=${paletteId}, font=${fontId}, layout=${layoutType}, density=${density}, mood=${mood}, motif=${motif}`);

    // Build alternatives
    const rawAlternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
    const alternatives: AlternativeDirection[] = rawAlternatives.slice(0, 3).map((a: Record<string, unknown>, idx: number) => {
      const altMotif = motifs[idx + 1] || motifs[0] || 'geometric-lines';
      return {
        paletteId: String(a.paletteId || paletteId),
        fontId: String(a.fontId || fontId),
        layoutType: String(a.layoutType || layoutType) as LayoutType,
        density: (a.density || density) as 'sparse' | 'moderate' | 'rich',
        mood: String(a.mood || mood),
        styleName: String(a.styleName || `${styleName}·变体${idx + 1}`),
      };
    });

    const totalDuration = Date.now() - startTime;
    log.info(`[suggestCoverStyle] complete in ${totalDuration}ms, alternatives=${alternatives.length}`);

    return { success: true, designDNA, alternatives };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[suggestCoverStyle] failed: ${msg}`);
    return { success: false, error: msg };
  }
}
