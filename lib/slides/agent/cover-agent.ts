/**
 * Cover Agent — generates 12 DesignDNA variants for a given topic.
 *
 * 12 concurrent LLM calls (throttled to 6), each generating 1 cover skeleton.
 * Salvage-first: malformed LLM output is repaired before rejecting.
 * Per-slot retries as safety net for truly broken output.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import {
  validateDesignDNA,
  COLOR_PALETTES, FONT_PAIRS,
  ALLOWED_MOTIFS,
  MOTIF_LAYOUT_POOL,
} from './design-dna';
import type { LayoutType } from './design-dna';

const log = createLogger('CoverAgent');

// ── Zod schema for LLM output validation ───────────────────────────────

export const coverSkeletonSchema = z.object({
  styleName: z.string().min(2).max(12),
  fontId: z.enum(['arial-black-arial', 'calibri-light', 'impact-arial']),
  density: z.enum(['sparse', 'moderate', 'rich']),
  mood: z.string().min(2).max(15),
  bestFor: z.array(z.string().min(1).max(20)).min(1).max(4),
});

type CoverSkeleton = z.infer<typeof coverSkeletonSchema>;

// ── JSON Salvage — repair common LLM output flaws ──────────────────────

/**
 * Attempt to salvage malformed JSON from LLM output.
 * Handles: markdown fences, control chars, trailing commas,
 * truncated JSON (unmatched braces/brackets).
 * Returns the repaired JSON string, or null if irreparable.
 */
export function salvageJson(raw: string): string | null {
  let s = raw.trim();

  // 1. Strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, '');
  s = s.replace(/\s*```$/i, '');

  // 2. Remove control characters (except common whitespace)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');

  // 3. Remove trailing commas (before }/] or at absolute end)
  s = s.replace(/,(\s*[}\]])/g, '$1');
  s = s.replace(/,\s*$/, '');

  // 4. Auto-close unmatched braces and brackets
  let depth = 0;
  const stack: string[] = [];
  for (const ch of s) {
    if (ch === '{' || ch === '[') {
      depth++;
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }
  // Append missing closers in reverse order
  while (stack.length > 0) {
    s += stack.pop()!;
  }

  // 5. Try to parse
  try {
    JSON.parse(s);
    return s;
  } catch {
    // 6. Last resort: try to find JSON object boundaries
    const objStart = s.indexOf('{');
    const objEnd = s.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      const extracted = s.slice(objStart, objEnd + 1);
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // irreparable
      }
    }
    return null;
  }
}

// ── Concurrency limiter (collects results, never kills on single failure) ──

function concurrencyLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let running = 0;
  let cursor = 0;

  return new Promise((resolve, reject) => {
    let firstFatal: unknown = null;

    function next() {
      while (running < limit && cursor < tasks.length) {
        const idx = cursor++;
        running++;
        tasks[idx]()
          .then((result) => {
            results[idx] = result;
            running--;
            next();
          })
          .catch((err) => {
            if (!firstFatal) firstFatal = err;
            results[idx] = undefined as unknown as T;
            running--;
            next();
          });
      }
      if (running === 0 && cursor >= tasks.length) {
        const valid = results.filter((r) => r !== undefined);
        if (valid.length === 0 && firstFatal) {
          reject(firstFatal);
        } else {
          resolve(results);
        }
      }
    }

    next();
  });
}

// ── Prompt ────────────────────────────────────────────────────────────

const DESIGN_NOTES = `
## Design Rules
- One dominant color, 1-2 supporting, one sharp accent
- Dark background for cover/end, light for content ("sandwich" structure)
- Motifs by subject: Math/Physics → geometric-lines/neon-grid, Literature/History → ink-wash/chinese-seal, Biology/Geography → organic-circles
- NEVER center body text, NEVER add thin lines under titles, NEVER use low-contrast
`;

function buildSystemPrompt(): string {
  return `You are a senior presentation designer. Design 1 cover visual scheme.

${DESIGN_NOTES}

## Output Format
A single JSON object:
{
  "styleName": "风格名称≤12字",
  "fontId": "arial-black-arial",
  "styleName": "现代学术",
  "density": "moderate",
  "mood": "风格情绪≤15字",
  "bestFor": ["学科1"]
}

Available fonts: arial-black-arial, calibri-light, impact-arial
Recommended: arial-black-arial (modern sans-serif, best for Chinese academic presentations)
Available densities: sparse, moderate, rich

## Rules
- styleName: natural style name like "科技暗金", "书香墨韵". NEVER include the topic name.
- fontId: pick one from the available list.
- bestFor: 1-4 subject names, each ≤20 characters.
- Output ONLY the JSON object. No markdown, no explanation.`;
}

function buildUserPrompt(
  topic: string,
  difficulty: string,
  paletteId: string,
  motif: string,
  isRecommended: boolean,
): string {
  return `Topic: ${topic}
Difficulty: ${difficulty}
Assigned palette: ${paletteId}
Assigned motif: ${motif}
${isRecommended ? 'This should be the RECOMMENDED design.' : ''}

Design 1 cover visual scheme. Output a single JSON object.`;
}

// ── Skeleton → DesignDNA assembly ─────────────────────────────────────

export function assembleDesignDNA(
  skeleton: CoverSkeleton,
  paletteId: string,
  motif: string,
  layoutType: LayoutType,
): DesignDNA {
  const palette = COLOR_PALETTES[paletteId] ?? COLOR_PALETTES['midnight-executive'];
  const fonts = FONT_PAIRS[skeleton.fontId] ?? FONT_PAIRS['arial-black-arial'];

  const cardStyle: DesignDNA['components']['cardStyle'] =
    motif === 'chinese-seal' ? 'accent-left-bar' :
    motif === 'ink-wash' ? 'shadow-only' :
    'accent-left-bar';

  const bulletStyle: DesignDNA['components']['bulletStyle'] =
    motif === 'chinese-seal' || motif === 'ink-wash' ? 'chinese-brush' : 'dot';

  const pageNumberStyle: DesignDNA['components']['pageNumberStyle'] =
    motif === 'chinese-seal' ? 'circle-number' : 'number-slash-total';

  return {
    styleName: skeleton.styleName,
    recommended: false,
    colors: { ...palette },
    fonts: { ...fonts },
    decoration: { motif: motif as DesignDNA['decoration']['motif'], density: skeleton.density as DesignDNA['decoration']['density'], cornerWeight: 'top-right' },
    components: { cardStyle, bulletStyle, pageNumberStyle },
    layoutType,
    mood: skeleton.mood,
    bestFor: skeleton.bestFor,
  };
}

// ── Per-slot generation with salvage + retry ───────────────────────────

const CALL_LLM_RETRIES = 1;   // Internal LLM retries (format issues → salvage handles)
const SLOT_MAX_RETRIES = 2;   // Outer retries for truly broken output

interface SlotResult {
  cover?: CoverItem;
  error?: string;
}

export interface CoverItem {
  id: number;
  styleName: string;
  recommended: boolean;
  designDNA: DesignDNA;
}

async function generateOneCover(
  slotIndex: number,
  topic: string,
  difficulty: string,
  paletteId: string,
  motif: string,
  layoutType: LayoutType,
  isRecommended: boolean,
  languageModel: LanguageModel,
): Promise<SlotResult> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(topic, difficulty, paletteId, motif, isRecommended);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < SLOT_MAX_RETRIES; attempt++) {
    try {
      const result = await callLLM(
        {
          model: languageModel,
          system,
          prompt: user,
          maxOutputTokens: 2048,
          temperature: 0.8,
        },
        `cover-agent-${slotIndex}`,
        {
          retries: CALL_LLM_RETRIES,
          timeoutMs: 30000,
          validate: (text) => {
            // Salvage before judging — most LLM format flaws are fixable
            const repaired = salvageJson(text);
            if (!repaired) return false;
            return repaired.includes('styleName') && repaired.includes('fontId');
          },
        },
      );

      // Salvage + parse
      const repaired = salvageJson(result.text);
      if (!repaired) {
        lastError = 'Salvage failed — output irreparable';
        log.warn(`Cover ${slotIndex + 1} attempt ${attempt + 1}: ${lastError}`);
        continue;
      }

      let raw: unknown;
      try {
        raw = JSON.parse(repaired);
      } catch (parseErr) {
        lastError = `JSON parse after salvage failed — ${String(parseErr).slice(0, 100)}`;
        log.warn(`Cover ${slotIndex + 1} attempt ${attempt + 1}: ${lastError}`);
        continue;
      }

      // Zod validate
      const parsed = coverSkeletonSchema.safeParse(raw);
      if (!parsed.success) {
        lastError = parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ');
        log.warn(`Cover ${slotIndex + 1} attempt ${attempt + 1}: Schema — ${lastError}`);
        continue;
      }

      // Debug log
      try {
        const debugDir = path.resolve(process.cwd(), 'logs');
        await fs.mkdir(debugDir, { recursive: true });
        await fs.writeFile(
          path.join(debugDir, `cover-agent-${slotIndex}-${Date.now()}.txt`),
          `TOPIC: ${topic}\nATTEMPT: ${attempt + 1}\nSALVAGED: ${repaired !== result.text.trim() ? 'yes' : 'no'}\n\n--- RAW ---\n${result.text}\n--- END ---`,
          'utf-8',
        );
      } catch { /* non-critical */ }

      const dna = assembleDesignDNA(parsed.data, paletteId, motif, layoutType);
      const validation = validateDesignDNA(dna);

      return {
        cover: {
          id: slotIndex + 1,
          styleName: validation.designDNA.styleName,
          recommended: isRecommended,
          designDNA: validation.designDNA,
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log.warn(`Cover ${slotIndex + 1} attempt ${attempt + 1}: ${lastError.slice(0, 120)}`);
    }
  }

  return { error: `Cover ${slotIndex + 1}: failed after ${SLOT_MAX_RETRIES} attempts — ${lastError || 'unknown'}` };
}

// ── Public API ─────────────────────────────────────────────────────────

export interface CoverGenerationResult {
  success: boolean;
  covers?: CoverItem[];
  error?: string;
}

// ── Topic-aware motif assignment ──────────────────────────────────────

type SubjectCategory = 'humanities' | 'stem' | 'science' | 'general';

const SUBJECT_KEYWORDS: Array<{ category: SubjectCategory; keywords: RegExp[] }> = [
  {
    category: 'humanities',
    keywords: [
      /英语|语文|历史|文学|政治|哲学|法律|经济|管理|艺术|音乐|美术|书法|诗词|小说|散文|戏剧|语言|外语|翻译|写作|阅读|文化|社会/i,
      /english|literature|history|philosophy|law|art|music|language|writing|reading|culture|society/i,
    ],
  },
  {
    category: 'stem',
    keywords: [
      /数学|物理|化学|计算机|编程|算法|数据结构|微积分|线性代数|概率|统计|力学|电磁|光学|量子|热力|电路|电子|通信|信号|控制|自动化|人工智能|机器学|深度学|神经网络/i,
      /math|physics|chemistry|computer|programming|algorithm|calculus|linear.*algebra|mechanics|electromag|optics|quantum|circuit/i,
    ],
  },
  {
    category: 'science',
    keywords: [
      /生物|地理|地质|天文|气象|海洋|生态|环境|医学|药学|农学|植物|动物|细胞|基因|进化/i,
      /biology|geography|geology|astronomy|ecology|environment|medical|medicine|cell|gene|evolution/i,
    ],
  },
];

/** Ordered from most relevant to least for each category */
const CATEGORY_MOTIFS: Record<SubjectCategory, string[]> = {
  humanities: ['ink-wash', 'chinese-seal', 'organic-circles', 'geometric-lines', 'neon-grid'],
  stem:       ['geometric-lines', 'neon-grid', 'organic-circles', 'ink-wash', 'chinese-seal'],
  science:    ['organic-circles', 'neon-grid', 'geometric-lines', 'ink-wash', 'chinese-seal'],
  general:    ['geometric-lines', 'ink-wash', 'neon-grid', 'organic-circles', 'chinese-seal'],
};

/** How many slots each motif tier gets (out of 12). Different per category. */
const TIER_QUOTAS: Record<SubjectCategory, number[]> = {
  humanities: [5, 4, 3, 0, 0],
  stem:       [5, 4, 3, 0, 0],
  science:    [5, 4, 3, 0, 0],
  general:    [3, 3, 2, 2, 2], // balanced spread — unknown topic gets all 5 motifs
};

function inferCategory(topic: string): SubjectCategory {
  for (const entry of SUBJECT_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (kw.test(topic)) return entry.category;
    }
  }
  return 'general';
}

/**
 * Assign 12 motif slots based on topic relevance.
 * High-priority motifs get more slots; irrelevant motifs get zero.
 */
export function getMotifsForTopic(topic: string): string[] {
  const category = inferCategory(topic);
  const ranked = CATEGORY_MOTIFS[category];
  const motifs: string[] = [];

  for (let tier = 0; tier < ranked.length; tier++) {
    const quota = TIER_QUOTAS[category][tier] ?? 0;
    for (let i = 0; i < quota && motifs.length < 12; i++) {
      motifs.push(ranked[tier]);
    }
  }

  // Fill remaining slots with tier-1 motifs if quotas don't sum to 12
  while (motifs.length < 12) {
    motifs.push(ranked[0]);
  }

  // Shuffle within each tier to avoid adjacent duplicates
  return motifs.sort(() => Math.random() - 0.5);
}

const MIN_SUCCESSFUL_COVERS = 8;

export async function generateCovers(
  topic: string,
  difficulty: string,
  languageModel: LanguageModel,
): Promise<CoverGenerationResult> {
  const startTime = Date.now();
  log.info(`Generating 12 covers for "${topic}" [concurrent×6, salvage+${SLOT_MAX_RETRIES}retries]`);

  // ── Pre-assign paletteIds ──
  const paletteIds = Object.keys(COLOR_PALETTES);
  for (let i = paletteIds.length - 1; i > paletteIds.length - 13 && i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paletteIds[i], paletteIds[j]] = [paletteIds[j], paletteIds[i]];
  }
  const assignedPalettes = paletteIds.slice(0, 12);

  // ── Pre-assign motifs (topic-aware) ──
  const assignedMotifs = getMotifsForTopic(topic);

  // ── Pre-allocate layouts ──
  const poolIndex: Record<string, number> = {};
  const usedLayouts = new Set<string>();
  const assignedLayouts: LayoutType[] = [];
  for (let i = 0; i < 12; i++) {
    const motif = assignedMotifs[i];
    const pool = MOTIF_LAYOUT_POOL[motif] || MOTIF_LAYOUT_POOL['geometric-lines'];
    const idx = (poolIndex[motif] || 0) % pool.length;
    poolIndex[motif] = idx + 1;
    let candidate = pool[idx];
    for (let tries = 0; tries < 3 && usedLayouts.has(candidate); tries++) {
      const nextIdx = (poolIndex[motif] || 0) % pool.length;
      poolIndex[motif] = nextIdx + 1;
      candidate = pool[nextIdx];
    }
    usedLayouts.add(candidate);
    assignedLayouts.push(candidate);
  }

  // ── Build tasks ──
  const tasks = Array.from({ length: 12 }, (_, i) =>
    () => generateOneCover(i, topic, difficulty, assignedPalettes[i], assignedMotifs[i], assignedLayouts[i], i === 0, languageModel),
  );

  // ── Execute ──
  const slotResults: SlotResult[] = await concurrencyLimit(tasks, 6);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const covers: CoverItem[] = [];
  const errors: string[] = [];
  for (const sr of slotResults) {
    if (sr?.cover) covers.push(sr.cover);
    else if (sr?.error) errors.push(sr.error);
  }

  log.info(`12 covers in ${elapsed}s — ${covers.length}✓ ${errors.length}✗`);
  if (errors.length > 0) log.warn(`Failed: ${errors.join(' | ')}`);

  if (covers.length < MIN_SUCCESSFUL_COVERS) {
    return {
      success: false,
      error: `封面生成不完整：${covers.length}/12 成功（最低 ${MIN_SUCCESSFUL_COVERS}）。${errors.slice(0, 3).join('; ')}`,
    };
  }

  const recCount = covers.filter((c) => c.recommended).length;
  if (recCount !== 1) {
    covers.forEach((c) => (c.recommended = false));
    covers[0].recommended = true;
  }

  return { success: true, covers };
}
