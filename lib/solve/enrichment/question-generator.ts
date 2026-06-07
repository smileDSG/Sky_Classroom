/**
 * LLM Question Generator — uses DeepSeek to generate diverse educational
 * questions when external datasets are unavailable.
 *
 * Flow:
 *   LLM generates question + reference answer
 *   → solve pipeline independently solves it
 *   → if solve confidence ≥ threshold AND answer matches reference
 *   → store in question bank
 *
 * This creates a self-validating loop: the generator proposes,
 * the solver verifies, and only verified questions enter the bank.
 */

import type { ExtractedQuestion, SubjectId, GradeLevel } from './types';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';
import { SUBJECT_MAP, GRADE_MAP } from './config';

const log = createLogger('Enrichment:Generator');

// ── Types ────────────────────────────────────────────────────────────

interface GeneratedQuestionRaw {
  problemText: string;
  answer: string;
  questionType: string;
  difficulty: string;
  knowledgePoint: string;
}

interface GenerationResponse {
  questions: GeneratedQuestionRaw[];
}

// ── Prompt templates per subject ─────────────────────────────────────

const SUBJECT_PROMPT_CONTEXT: Record<string, string> = {
  math: `请生成高中数学题目。包含以下题型：
- 选择题（4个选项A/B/C/D）
- 填空题
- 解答题（含计算、证明）
知识点覆盖：函数与导数、三角函数、数列、立体几何、解析几何、概率统计、向量、不等式。
数学公式用LaTeX格式（如 $f(x) = x^2 + 2x + 1$）。
答案必须精确（选择题仅写选项字母如"A"，填空题写数值，解答题写关键步骤和最终结果）。`,

  physics: `请生成高中物理题目。包含以下题型：
- 选择题（4个选项A/B/C/D）
- 填空题
- 解答题（含计算、推导）
知识点覆盖：力学（牛顿定律、万有引力）、电磁学（电场、磁场、电磁感应）、热力学、光学、近代物理。
数学公式用LaTeX格式。物理量带单位。`,

  chemistry: `请生成高中化学题目。包含以下题型：
- 选择题（4个选项A/B/C/D）
- 填空题
- 解答题（含化学方程式配平、计算）
知识点覆盖：氧化还原反应、离子反应、化学平衡、有机化学、物质结构、元素周期律。
化学方程式用正确格式：$\\ce{H2 + O2 -> H2O}$。`,

  chinese: `请生成高中语文题目。包含以下题型：
- 文言文阅读理解（含翻译题）
- 现代文阅读理解
- 古诗词鉴赏
- 语言文字运用（成语、病句、修辞）`,

  english: `请生成高中英语题目。包含以下题型：
- 阅读理解（短文+4个选择题）
- 完形填空
- 语法填空
- 短文改错`,

  biology: `请生成高中生物题目。包含以下题型：
- 选择题（4个选项A/B/C/D）
- 填空题
知识点覆盖：细胞生物学、遗传学、进化论、生态学、植物生理、动物生理。`,

  history: `请生成高中历史题目。包含以下题型：
- 选择题（4个选项A/B/C/D）
- 材料解析题
知识点覆盖：中国古代史、中国近现代史、世界古代史、世界近现代史。`,
};

const GENERATION_SYSTEM_PROMPT = `你是一个资深教育题库出题专家。你生成的题目必须准确、有教育价值、符合所标注的难度级别。

## 输出格式
返回JSON：
{
  "questions": [
    {
      "problemText": "完整的题目文本（包括所有选项和条件，LaTeX格式）",
      "answer": "正确答案（选择题写选项字母，填空题写数值/表达式，解答题写关键步骤）",
      "questionType": "choice|fill|solve|judge",
      "difficulty": "easy|medium|hard",
      "knowledgePoint": "对应的知识点名称"
    }
  ]
}

## 规则
1. 每批生成5道题，难度分布：1道easy + 2道medium + 2道hard
2. 题目必须新颖，不能是网上常见的原题
3. 答案必须100%正确，这是入库的基本要求
4. 数学公式用LaTeX $...$ 格式
5. 每道题必须标注对应的知识点
6. 选择题必须提供完整的4个选项`;

// ── Model resolution ────────────────────────────────────────────────

/**
 * Resolve the DeepSeek model config for question generation.
 * Follows the same pattern as resolveSolverModel in solver-agent.ts.
 */
function resolveGeneratorModel() {
  const providerId = 'deepseek' as const;
  // Use pro model for more reliable structured output generation
  const modelId = 'deepseek-v4-pro';
  return {
    providerId,
    modelId,
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
    providerType: 'openai' as const,
  };
}

// ── Generator ────────────────────────────────────────────────────────

export interface GenerateQuestionsOptions {
  subject: SubjectId;
  gradeLevel: GradeLevel;
  /** Number of questions to generate (default 10, max 50) */
  count?: number;
  /** Specific question types to generate */
  types?: Array<'choice' | 'fill' | 'solve' | 'judge'>;
}

/**
 * Generate educational questions using DeepSeek.
 *
 * @returns Array of ExtractedQuestion (with sourceAnswer from the generator)
 */
export async function generateQuestions(
  opts: GenerateQuestionsOptions,
): Promise<ExtractedQuestion[]> {
  const { subject, gradeLevel, count = 10 } = opts;

  const subjectConfig = SUBJECT_MAP[subject];
  const gradeConfig = GRADE_MAP[gradeLevel];
  if (!subjectConfig) return [];

  const subjectContext = SUBJECT_PROMPT_CONTEXT[subject]
    ?? `请生成${gradeConfig?.label ?? ''}${subjectConfig.label}题目。`;

  const batches = Math.ceil(count / 5);
  const allQuestions: ExtractedQuestion[] = [];
  const seen = new Set<string>();

  for (let batch = 0; batch < batches; batch++) {
    const batchCount = Math.min(5, count - allQuestions.length);
    if (batchCount <= 0) break;

    const userPrompt = `${subjectContext}

年级：${gradeConfig?.label ?? '高中'}
本次生成 ${batchCount} 道题。

当前是第 ${batch + 1}/${batches} 批，请确保与之前生成的题目不重复。`;

    try {
      const modelWithInfo = getModel(resolveGeneratorModel());

      const result = await callLLM(
        {
          model: modelWithInfo.model,
          messages: [
            { role: 'system', content: GENERATION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ] as any,
          temperature: 0.4,
          maxOutputTokens: 4096,
        },
        'enrichment-generator',
        { retries: 2, timeoutMs: 60000 },
      );

      log.info(`[Generator] Raw response length: ${result.text?.length ?? 0}, first 200: ${result.text?.slice(0, 200) ?? '(empty)'}`);

      let parsed = parseJsonResponse<GenerationResponse>(result.text);

      // Fallback: regex extract JSON blocks from raw text when json-repair fails
      if (!parsed?.questions?.length) {
        const jsonStart = result.text.indexOf('{');
        const jsonEnd = result.text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          try {
            const candidate = JSON.parse(result.text.slice(jsonStart, jsonEnd + 1)) as GenerationResponse;
            if (candidate?.questions?.length) {
              parsed = candidate;
              log.info('[Generator] Batch recovered via regex fallback');
            }
          } catch { /* not valid JSON — will be caught by next guard */ }
        }
      }

      if (!parsed?.questions?.length) {
        log.warn(`[Generator] Batch ${batch + 1}: no valid questions — raw text: ${result.text?.slice(0, 500) ?? '(null)'}`);
        continue;
      }

      for (const q of parsed.questions) {
        if (!q.problemText || q.problemText.length < 10) continue;
        if (!q.answer) continue;

        // Dedup
        const key = q.problemText.slice(0, 100);
        if (seen.has(key)) continue;
        seen.add(key);

        allQuestions.push({
          problemText: q.problemText.trim().slice(0, 3000),
          subject,
          gradeLevel,
          questionType: normalizeType(q.questionType),
          sourceAnswer: q.answer.trim(),
          sourceUrl: `generated://${subject}/${gradeLevel}/${Date.now()}`,
          extractionConfidence: 0.7, // LLM-generated, not extracted
        });
      }

      log.info(`[Generator] Batch ${batch + 1}: ${parsed.questions.length} generated`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[Generator] Batch ${batch + 1} failed: ${msg}`);
    }
  }

  log.info(`[Generator] Total: ${allQuestions.length} questions generated for ${subject}/${gradeLevel}`);
  return allQuestions;
}

function normalizeType(raw: string): ExtractedQuestion['questionType'] {
  const s = raw.toLowerCase().trim();
  if (s.includes('choice') || s.includes('选择')) return 'choice';
  if (s.includes('fill') || s.includes('填空')) return 'fill';
  if (s.includes('solve') || s.includes('解答') || s.includes('证明')) return 'solve';
  if (s.includes('judge') || s.includes('判断')) return 'judge';
  return 'solve';
}
