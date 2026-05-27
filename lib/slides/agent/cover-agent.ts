/**
 * Cover Agent — generates 12 DesignDNA variants for a given topic.
 *
 * Optimized: LLM outputs lightweight skeleton (paletteId + fontId + motif),
 * code looks up full color/font values from pre-defined tables.
 * Reduces LLM output from ~3600 tokens to ~720 tokens (~5x faster).
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import {
  validateDesignDNA, getDefaultDesignDNA,
  COLOR_PALETTES, FONT_PAIRS,
  ALLOWED_MOTIFS, ALLOWED_CARD_STYLES, ALLOWED_BULLET_STYLES, ALLOWED_PAGE_NUMBER_STYLES,
  MOTIF_LAYOUT_POOL, ALLOWED_LAYOUT_TYPES,
} from './design-dna';
import type { LayoutType } from './design-dna';

const log = createLogger('CoverAgent');

// ── Lightweight skeleton prompt ────────────────────────────────────────

function buildPaletteList(): string {
  return Object.keys(COLOR_PALETTES).map((id) => {
    const p = COLOR_PALETTES[id];
    return `  ${id}: cover=${p.coverBg} content=${p.contentBg} accent=${p.accent}`;
  }).join('\n');
}

function buildFontList(): string {
  return Object.keys(FONT_PAIRS).map((id) => {
    const f = FONT_PAIRS[id];
    return `  ${id}: en=${f.en} sizes=${f.headingSize}/${f.pageTitleSize}/${f.bodySize}`;
  }).join('\n');
}

const DESIGN_NOTES = `
## Design Rules
- One dominant color, 1-2 supporting, one sharp accent
- Dark background for cover/end, light for content ("sandwich" structure)
- Motifs by subject: Math/Physics → geometric-lines/neon-grid, Literature/History → ink-wash/chinese-seal, Biology/Geography → organic-circles
- NEVER center body text, NEVER add thin lines under titles, NEVER use low-contrast
`;

function buildSystemPrompt(): string {
  return `You are a senior presentation designer. Design 12 cover visual schemes for a teaching slide deck.

## Color Palettes (pick paletteId, NOT hex values)
${buildPaletteList()}

## Font Pairings (pick fontId)
${buildFontList()}

${DESIGN_NOTES}

## Output Rules
1. Pick paletteId and fontId from the lists above — DO NOT output hex colors or font details
2. Generate exactly 12 different schemes, each with a DIFFERENT paletteId
3. Only ONE scheme with recommended:true — the best matching topic's subject
4. Output pure JSON array only — no markdown fences
5. styleName MUST be a natural style name (e.g. "科技暗金", "书香墨韵", "极简白"). NEVER include the topic name or topic-related words in styleName. The name describes the visual style only, not the content.

## Output Format (compact skeleton)
[
  {
    "styleName": "风格名称≤8字",
    "paletteId": "midnight-executive",
    "fontId": "georgia-calibri",
    "motif": "geometric-lines",
    "density": "moderate",
    "recommended": true,
    "mood": "风格情绪≤10字",
    "bestFor": ["学科1"]
  },
  ...
]
Available motifs: ${ALLOWED_MOTIFS.join(', ')}
Available densities: sparse, moderate, rich`;
}

function buildUserPrompt(topic: string, difficulty: string): string {
  return `Topic: ${topic}
Difficulty: ${difficulty}

Design 12 different cover visual schemes. Output the compact skeleton JSON array with 12 items.`;
}

// ── Skeleton → DesignDNA assembly (code-level, no LLM) ─────────────────

interface CoverSkeleton {
  styleName?: string;
  paletteId?: string;
  fontId?: string;
  motif?: string;
  density?: string;
  recommended?: boolean;
  mood?: string;
  bestFor?: string[];
}

function assembleDesignDNA(skeleton: CoverSkeleton, index: number, layoutType: LayoutType): DesignDNA {
  const palette = COLOR_PALETTES[skeleton.paletteId ?? ''] ?? COLOR_PALETTES['midnight-executive'];
  const fonts = FONT_PAIRS[skeleton.fontId ?? ''] ?? FONT_PAIRS['georgia-calibri'];
  const motif = ALLOWED_MOTIFS.includes(skeleton.motif as never) ? skeleton.motif! : 'geometric-lines';
  const density = (['sparse', 'moderate', 'rich'] as const).includes(skeleton.density as never) ? skeleton.density! : 'moderate';

  // Auto-derive card style from motif
  const cardStyle: DesignDNA['components']['cardStyle'] =
    motif === 'chinese-seal' ? 'accent-left-bar' :
    motif === 'ink-wash' ? 'shadow-only' :
    'accent-left-bar';

  // Auto-derive bullet style
  const bulletStyle: DesignDNA['components']['bulletStyle'] =
    motif === 'chinese-seal' || motif === 'ink-wash' ? 'chinese-brush' : 'dot';

  // Auto-derive page number style
  const pageNumberStyle: DesignDNA['components']['pageNumberStyle'] =
    motif === 'chinese-seal' ? 'circle-number' : 'number-slash-total';

  return {
    styleName: skeleton.styleName || `风格 ${index + 1}`,
    recommended: skeleton.recommended || false,
    colors: { ...palette },
    fonts: { ...fonts },
    decoration: { motif: motif as DesignDNA['decoration']['motif'], density: density as DesignDNA['decoration']['density'], cornerWeight: 'top-right' },
    components: { cardStyle, bulletStyle, pageNumberStyle },
    layoutType,
    mood: skeleton.mood || '专业学术',
    bestFor: skeleton.bestFor || ['通用'],
  };
}

// ── JSON Cleanup ──────────────────────────────────────────────────────

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return cleaned;
}

// ── Public API ─────────────────────────────────────────────────────────

export interface CoverGenerationResult {
  success: boolean;
  covers?: Array<{ id: number; styleName: string; recommended: boolean; designDNA: DesignDNA; replaced: boolean }>;
  error?: string;
}

export async function generateCovers(
  topic: string,
  difficulty: string,
  languageModel: LanguageModel,
): Promise<CoverGenerationResult> {
  try {
    const system = buildSystemPrompt();
    const user = buildUserPrompt(topic, difficulty);

    log.info(`Generating 12 cover skeletons for "${topic}"`);

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: 4096, temperature: 0.8 },
      'cover-agent',
      { retries: 1, validate: (text) => {
        const t = text.trim();
        return t.length > 500 && t.includes('paletteId') && (t.endsWith(']') || t.endsWith('}]'));
      } },
    );

    // Debug: save raw LLM output
    try {
      const debugPath = path.resolve(process.cwd(), 'logs', `cover-agent-debug-${Date.now()}.txt`);
      await fs.mkdir(path.dirname(debugPath), { recursive: true });
      await fs.writeFile(debugPath, `TOPIC: ${topic}\nLENGTH: ${result.text.length}\n\n--- RAW OUTPUT ---\n${result.text}\n\n--- END ---`, 'utf-8');
    } catch { /* ignore */ }

    // Parse skeletons
    const jsonText = cleanJsonText(result.text);
    log.info(`Cleaned JSON length: ${jsonText.length}, first 200 chars: ${jsonText.slice(0, 200)}`);

    let rawArray: CoverSkeleton[];
    try {
      rawArray = JSON.parse(jsonText);
    } catch (parseErr) {
      log.error(`Cover agent JSON parse failed: ${parseErr}`);
      // Try to salvage: extract JSON array from text
      const arrayMatch = result.text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          rawArray = JSON.parse(cleanJsonText(arrayMatch[0]));
        } catch {
          return fallbackCovers(topic);
        }
      } else {
        return fallbackCovers(topic);
      }
    }

    if (!Array.isArray(rawArray) || rawArray.length === 0) {
      log.error('Cover agent output is not a valid array');
      return fallbackCovers(topic);
    }

    // ── Distribute layoutTypes: each motif has a pool; cycle through to ensure all 12 different ──
    const poolIndex: Record<string, number> = {};
    function nextLayout(motif: string): LayoutType {
      const pool = MOTIF_LAYOUT_POOL[motif] || MOTIF_LAYOUT_POOL['geometric-lines'];
      const idx = (poolIndex[motif] || 0) % pool.length;
      poolIndex[motif] = idx + 1;
      return pool[idx];
    }
    // Pre-allocate: ensure every cover has a unique layout if possible
    const usedLayouts = new Set<string>();
    const layouts: LayoutType[] = [];
    for (let i = 0; i < rawArray.length; i++) {
      const motif = (rawArray[i].motif || 'geometric-lines') as string;
      let candidate = nextLayout(motif);
      // Try up to 3 times to avoid duplicate
      for (let tries = 0; tries < 3 && usedLayouts.has(candidate); tries++) {
        candidate = nextLayout(motif);
      }
      usedLayouts.add(candidate);
      layouts.push(candidate);
    }

    // Assemble full DesignDNA from skeletons
    const covers: CoverGenerationResult['covers'] = [];
    for (let i = 0; i < rawArray.length; i++) {
      const dna = assembleDesignDNA(rawArray[i], i, layouts[i]);
      const validation = validateDesignDNA(dna);
      covers.push({
        id: i + 1,
        styleName: validation.designDNA.styleName,
        recommended: validation.designDNA.recommended,
        designDNA: validation.designDNA,
        replaced: !validation.valid,
      });
    }

    // Ensure exactly one recommended
    const recCount = covers.filter((c) => c.recommended).length;
    if (recCount !== 1) {
      covers.forEach((c) => (c.recommended = false));
      covers[0].recommended = true;
    }

    // Ensure 12
    while (covers.length < 12) {
      covers.push({
        id: covers.length + 1,
        styleName: `风格 ${covers.length + 1}`,
        recommended: false,
        designDNA: getDefaultDesignDNA(),
        replaced: true,
      });
    }

    log.info(`Assembled ${covers.length} cover designs from skeletons`);
    return { success: true, covers: covers.slice(0, 12) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Cover generation failed: ${msg}`);
    return { success: false, error: msg };
  }
}

function fallbackCovers(topic: string): CoverGenerationResult {
  const dna = getDefaultDesignDNA();
  return {
    success: true,
    covers: Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      styleName: `预设风格 ${i + 1}`,
      recommended: i === 0,
      designDNA: { ...dna, styleName: `预设风格 ${i + 1}` },
      replaced: true,
    })),
  };
}
