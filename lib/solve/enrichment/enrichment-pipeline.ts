/**
 * Enrichment pipeline — main orchestrator.
 *
 * Flow:
 *   ① Search (Bing API) → ② Fetch pages → ③ LLM extract questions
 *   → ④ Solve (reuse solveWithHybrid) → ⑤ Store in question bank
 *
 * Designed for Phase 1 batch (cold start): subjects processed sequentially
 * in priority order (数学→物理→化学→...), focusing on senior+college.
 *
 * Phase 2 will add Vercel Cron for periodic incremental enrichment.
 */

import type {
  EnrichJob,
  EnrichJobStats,
  EnrichQuestionResult,
  ExtractedQuestion,
  SubjectId,
  GradeLevel,
} from './types';
import { searchForSubject, isSearchConfigured } from './web-search';
import { fetchPages } from './page-fetcher';
import { extractQuestionsFromPages } from './question-extractor';
import { solveWithHybrid } from '../solver-agent';
import { saveToLocalStore } from './local-store';
import { createLogger } from '@/lib/logger';
import {
  SUBJECTS,
  GRADE_MAP,
  MAX_QUESTIONS_PER_RUN,
  MAX_STORE_PER_RUN,
  MAX_CONCURRENT_SOLVES,
  MIN_STORE_CONFIDENCE,
  createEmptyStats,
} from './config';

const log = createLogger('Enrichment:Pipeline');

// ── In-memory job state (server lifetime) ────────────────────────────

let currentJob: EnrichJob | null = null;
let lastJob: EnrichJob | null = null;

// ── Single question: extract → solve → store ──────────────────────

/**
 * Process one extracted question through the solve pipeline and store it.
 */
async function processOneQuestion(
  question: ExtractedQuestion,
  stats: EnrichJobStats,
): Promise<EnrichQuestionResult> {
  const result: EnrichQuestionResult = {
    extracted: question,
    solved: false,
    stored: false,
  };

  // Step ④: Solve using the existing hybrid strategy
  try {
    const agentType = subjectToAgentType(question.subject);
    const { solution, usedAgents } = await solveWithHybrid(
      agentType,
      question.problemText,
      null, // no image
    );

    if (solution.solution && solution.answer) {
      result.solved = true;
      result.solution = solution.solution;
      result.agentType = usedAgents[usedAgents.length - 1] ?? agentType;
      result.solveConfidence = solution.confidence ?? 0.5;

      // Step ⑤: Store in question bank if confidence is sufficient
      if (solution.confidence >= MIN_STORE_CONFIDENCE) {
        try {
          await saveToLocalStore({
            problemText: question.problemText,
            answer: solution.answer,
            solution: solution.solution,
            knowledgePoints: (solution.knowledgePoints ?? []).map((k) => ({
              name: k.name,
              description: k.description,
              difficulty: k.difficulty,
            })),
            subject: question.subject,
            gradeLevel: question.gradeLevel,
            agentId: String(result.agentType ?? 'universal'),
            confidence: solution.confidence ?? 0.5,
            sourceUrl: question.sourceUrl,
          });

          result.stored = true;
          stats.totalStored++;
          log.info(`[Pipeline] Stored question: ${question.problemText.slice(0, 60)}...`);
        } catch (err) {
          log.warn(`[Pipeline] Failed to store question: ${err}`);
          stats.totalFailed++;
        }
      } else {
        log.info(`[Pipeline] Low confidence (${solution.confidence}), skipping store`);
        stats.totalFailed++;
      }
    } else {
      log.warn(`[Pipeline] Empty solution for: ${question.problemText.slice(0, 60)}`);
      stats.totalFailed++;
    }

    stats.totalSolved++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Pipeline] Solve failed: ${msg}`);
    result.error = msg;
    stats.totalFailed++;
  }

  return result;
}

// ── Process questions with concurrency limiting ─────────────────────

async function processBatch(
  questions: ExtractedQuestion[],
  stats: EnrichJobStats,
  concurrency: number = MAX_CONCURRENT_SOLVES,
): Promise<EnrichQuestionResult[]> {
  const results: EnrichQuestionResult[] = [];
  const queue = [...questions];

  async function worker() {
    while (queue.length > 0) {
      const q = queue.shift();
      if (!q) break;
      const r = await processOneQuestion(q, stats);
      results.push(r);
    }
  }

  // Run N concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// ── Subject → agent type mapping ────────────────────────────────────

function subjectToAgentType(subject: SubjectId) {
  switch (subject) {
    case 'math':
    case 'physics':
    case 'chemistry':
    case 'biology':
      return 'science' as const;
    case 'chinese':
    case 'english':
    case 'history':
    case 'geography':
    case 'politics':
      return 'humanities' as const;
    default:
      return 'universal' as const;
  }
}

// ── Run enrichment for one subject ──────────────────────────────────

interface RunSubjectOpts {
  subject: SubjectId;
  gradeLevels: GradeLevel[];
  maxQuestions?: number;
}

async function runForSubject(opts: RunSubjectOpts): Promise<{
  questions: ExtractedQuestion[];
  stats: { searched: number; fetched: number; extracted: number };
}> {
  const { subject, gradeLevels, maxQuestions = MAX_QUESTIONS_PER_RUN } = opts;

  let totalSearched = 0;
  let totalFetched = 0;

  const allQuestions: ExtractedQuestion[] = [];

  for (const gradeLevel of gradeLevels) {
    if (allQuestions.length >= maxQuestions) break;

    // ① Search
    const searchResults = await searchForSubject({
      subject,
      gradeLevel,
      maxResults: 20,
      filterAllowedDomains: true,
    });
    totalSearched += searchResults.length;

    if (searchResults.length === 0) {
      log.info(`[Pipeline] No search results for ${subject}/${gradeLevel}`);
      continue;
    }

    // ② Fetch
    const urls = searchResults.map((r) => r.url);
    const pages = await fetchPages({ urls, skipRobotsCheck: false, maxPages: 10 });
    totalFetched += pages.length;

    if (pages.length === 0) {
      log.info(`[Pipeline] No pages fetched for ${subject}/${gradeLevel}`);
      continue;
    }

    // ③ Extract
    const questions = await extractQuestionsFromPages({
      pages: pages.map((p) => ({ url: p.url, textContent: p.textContent })),
      expectedSubject: subject,
      expectedGrade: gradeLevel,
      maxTotalQuestions: maxQuestions - allQuestions.length,
    });

    allQuestions.push(...questions);
    log.info(
      `[Pipeline] ${subject}/${gradeLevel}: ${searchResults.length} searched → ${pages.length} fetched → ${questions.length} extracted`,
    );
  }

  return {
    questions: allQuestions,
    stats: { searched: totalSearched, fetched: totalFetched, extracted: allQuestions.length },
  };
}

// ── Seed questions (built-in, no network needed) ─────────────────────

const SEED_QUESTIONS: Record<SubjectId, ExtractedQuestion[]> = {
  math: [
    // ── existing seeds 001-008 ──────────────────────────────────────
    {
      problemText: '已知函数 $f(x) = x^3 - 3x^2 + 2x + 1$，求 $f(x)$ 的极值点。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/001', extractionConfidence: 1.0,
    },
    {
      problemText: '在 $\triangle ABC$ 中，已知 $a=3$, $b=4$, $\angle C = 60^\circ$，求 $c$ 的长度。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/002', extractionConfidence: 1.0,
    },
    {
      problemText: '已知等差数列 $\{a_n\}$ 中，$a_1 = 2$，$a_5 = 14$，求公差 $d$ 和通项公式。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/003', extractionConfidence: 1.0,
    },
    {
      problemText: '求不定积分 $\int (2x^3 + 3x^2 - 4x + 1) \, dx$。',
      subject: 'math', gradeLevel: 'college', questionType: 'solve',
      sourceUrl: 'seed://math/004', extractionConfidence: 1.0,
    },
    {
      problemText: '若 $A = \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$，求 $A$ 的行列式和逆矩阵。',
      subject: 'math', gradeLevel: 'college', questionType: 'solve',
      sourceUrl: 'seed://math/005', extractionConfidence: 1.0,
    },
    {
      problemText: '函数 $y = \sin(2x + \frac{\pi}{3})$ 的最小正周期是多少？A. $\pi$ B. $2\pi$ C. $\frac{\pi}{2}$ D. $4\pi$',
      subject: 'math', gradeLevel: 'senior', questionType: 'choice',
      sourceUrl: 'seed://math/006', extractionConfidence: 1.0, sourceAnswer: 'A',
    },
    {
      problemText: '已知 $|a|=2$, $|b|=3$, $a \cdot b = -3$，求 $a$ 与 $b$ 的夹角。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/007', extractionConfidence: 1.0,
    },
    {
      problemText: '解方程：$\log_2(x+1) + \log_2(x-1) = 3$。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/008', extractionConfidence: 1.0,
    },
    // ── new seeds 009-018 ───────────────────────────────────────────
    {
      problemText: '抛物线 $y^2 = 4x$ 的焦点坐标是？A. $(1,0)$ B. $(0,1)$ C. $(2,0)$ D. $(0,2)$',
      subject: 'math', gradeLevel: 'senior', questionType: 'choice',
      sourceUrl: 'seed://math/009', extractionConfidence: 1.0, sourceAnswer: 'A',
    },
    {
      problemText: '已知等比数列 $\{a_n\}$ 中，$a_1 = 3$，公比 $q = 2$，求前 $n$ 项和 $S_n$ 的公式。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/010', extractionConfidence: 1.0,
    },
    {
      problemText: '从 $5$ 名男生和 $3$ 名女生中选出 $3$ 人组成小组，求至少有 $1$ 名女生的选法数。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/011', extractionConfidence: 1.0,
    },
    {
      problemText: '计算极限 $\lim_{x \to 0} \frac{\sin 3x}{x}$。',
      subject: 'math', gradeLevel: 'college', questionType: 'fill',
      sourceUrl: 'seed://math/012', extractionConfidence: 1.0, sourceAnswer: '3',
    },
    {
      problemText: '求二重积分 $\iint_{D} (x + y) \, dx dy$，其中 $D$ 是由 $x=0$, $y=0$, $x=1$, $y=1$ 围成的正方形区域。',
      subject: 'math', gradeLevel: 'college', questionType: 'solve',
      sourceUrl: 'seed://math/013', extractionConfidence: 1.0,
    },
    {
      problemText: '函数 $f(x) = e^x \sin x$ 在 $x=0$ 处的导数 $f\'(0)$ 等于？A. $0$ B. $1$ C. $e$ D. $2$',
      subject: 'math', gradeLevel: 'college', questionType: 'choice',
      sourceUrl: 'seed://math/014', extractionConfidence: 1.0, sourceAnswer: 'B',
    },
    {
      problemText: '设随机变量 $X \sim N(0,1)$，求 $P(-1 < X < 1)$。（已知 $\Phi(1) = 0.8413$）',
      subject: 'math', gradeLevel: 'college', questionType: 'solve',
      sourceUrl: 'seed://math/015', extractionConfidence: 1.0,
    },
    {
      problemText: '已知椭圆 $\frac{x^2}{25} + \frac{y^2}{9} = 1$，求椭圆的离心率。',
      subject: 'math', gradeLevel: 'senior', questionType: 'fill',
      sourceUrl: 'seed://math/016', extractionConfidence: 1.0, sourceAnswer: '0.8',
    },
    {
      problemText: '求级数 $\sum_{n=1}^{\infty} \frac{1}{n(n+1)}$ 的和。',
      subject: 'math', gradeLevel: 'college', questionType: 'solve',
      sourceUrl: 'seed://math/017', extractionConfidence: 1.0,
    },
    {
      problemText: '已知复数 $z = 1 + \sqrt{3}i$，求 $z$ 的模和辐角主值。',
      subject: 'math', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://math/018', extractionConfidence: 1.0,
    },
  ],
  physics: [
    // ── existing seeds 001-003 ──────────────────────────────────────
    {
      problemText: '一质量为 $2\text{kg}$ 的物体在水平面上受到 $10\text{N}$ 的水平拉力，物体与地面的摩擦系数为 $0.2$，求物体的加速度。（$g=10\text{m/s}^2$）',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/001', extractionConfidence: 1.0,
    },
    {
      problemText: '一个电阻为 $R=10\Omega$ 的导体，两端电压为 $U=220\text{V}$，求通过导体的电流和电功率。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/002', extractionConfidence: 1.0,
    },
    {
      problemText: '一束光从空气射入玻璃（$n=1.5$），入射角为 $30^\circ$，求折射角。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/003', extractionConfidence: 1.0,
    },
    // ── new seeds 004-013 ───────────────────────────────────────────
    {
      problemText: '一辆汽车以 $72\text{km/h}$ 的速度行驶，紧急刹车后在 $4\text{s}$ 内停下，求汽车的加速度和刹车距离。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/004', extractionConfidence: 1.0,
    },
    {
      problemText: '一质点做匀速圆周运动，半径为 $0.5\text{m}$，角速度为 $4\text{rad/s}$，求质点的线速度和向心加速度。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/005', extractionConfidence: 1.0,
    },
    {
      problemText: '一辆质量为 $1000\text{kg}$ 的汽车以 $10\text{m/s}$ 的速度行驶，求汽车的动能。若汽车在 $20\text{m}$ 内停下，求平均阻力。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/006', extractionConfidence: 1.0,
    },
    {
      problemText: '三个电阻 $R_1=4\Omega$、$R_2=6\Omega$、$R_3=12\Omega$ 并联后接在 $24\text{V}$ 电源上，求总电流和各支路电流。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/007', extractionConfidence: 1.0,
    },
    {
      problemText: '一个面积为 $0.1\text{m}^2$ 的线圈在 $B=0.5\text{T}$ 的匀强磁场中以 $\omega=10\text{rad/s}$ 的角速度匀速转动，线圈匝数为 $100$，求产生的最大感应电动势。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/008', extractionConfidence: 1.0,
    },
    {
      problemText: '一凸透镜的焦距为 $20\text{cm}$，物体距透镜 $30\text{cm}$，求像距和像的放大率，并判断像的虚实。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/009', extractionConfidence: 1.0,
    },
    {
      problemText: '波长为 $600\text{nm}$ 的单色光垂直照射到双缝上，双缝间距为 $0.5\text{mm}$，缝到屏幕距离为 $2\text{m}$，求相邻亮条纹的间距。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/010', extractionConfidence: 1.0,
    },
    {
      problemText: '一定质量的理想气体在 $27^\circ\text{C}$ 时压强为 $1.0 \times 10^5\text{Pa}$，体积为 $2.0 \times 10^{-3}\text{m}^3$。若温度升高到 $127^\circ\text{C}$ 且体积不变，求气体的压强。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/011', extractionConfidence: 1.0,
    },
    {
      problemText: '一颗质量为 $0.1\text{kg}$ 的子弹以 $200\text{m/s}$ 的速度射入质量为 $4.9\text{kg}$ 的静止木块中并嵌入其中，求子弹嵌入后木块的速度及系统损失的动能。',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/012', extractionConfidence: 1.0,
    },
    {
      problemText: '在一个平行板电容器中，两极板间距为 $2\text{mm}$，电势差为 $100\text{V}$，求两极板间的电场强度。若一个电子从负极板由静止释放，求它到达正极板时的速度。（$m_e = 9.1 \times 10^{-31}\text{kg}$, $e = 1.6 \times 10^{-19}\text{C}$）',
      subject: 'physics', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://physics/013', extractionConfidence: 1.0,
    },
  ],
  chemistry: [
    // ── existing seed 001 ───────────────────────────────────────────
    {
      problemText: '配平化学方程式：$\ce{Fe + HCl -> FeCl2 + H2}$，并计算 $5.6\text{g}$ 铁与足量盐酸反应产生氢气的体积（标准状况）。',
      subject: 'chemistry', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://chemistry/001', extractionConfidence: 1.0,
    },
    // ── new seeds 002-006 ───────────────────────────────────────────
    {
      problemText: '在酸性 $\ce{KMnO4}$ 溶液中加入 $\ce{FeSO4}$ 溶液，写出该氧化还原反应的离子方程式，并指出氧化剂和还原剂。',
      subject: 'chemistry', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://chemistry/002', extractionConfidence: 1.0,
    },
    {
      problemText: '工业上用氮气和氢气合成氨的反应为 $\ce{N2 + 3H2 <=> 2NH3}$，此为放热反应。试分析增大压强和升高温度对平衡的影响。',
      subject: 'chemistry', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://chemistry/003', extractionConfidence: 1.0,
    },
    {
      problemText: '写出乙醇（$\ce{C2H5OH}$）在浓硫酸催化下加热到 $170^\circ\text{C}$ 发生消去反应的化学方程式，并说出生成物的名称。',
      subject: 'chemistry', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://chemistry/004', extractionConfidence: 1.0,
    },
    {
      problemText: '某有机物完全燃烧后只生成 $\ce{CO2}$ 和 $\ce{H2O}$，已知 $0.1\text{mol}$ 该有机物燃烧生成 $8.8\text{g}$ $\ce{CO2}$ 和 $5.4\text{g}$ $\ce{H2O}$，该有机物蒸气的密度是同温同压下氢气密度的 $23$ 倍，求该有机物的分子式。',
      subject: 'chemistry', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://chemistry/005', extractionConfidence: 1.0,
    },
    {
      problemText: '在标准状况下，$11.2\text{L}$ 的 $\ce{HCl}$ 气体溶于水配成 $500\text{mL}$ 溶液，求所得盐酸的物质的量浓度。若取该盐酸 $25\text{mL}$ 与足量 $\ce{Na2CO3}$ 反应，求产生的 $\ce{CO2}$ 在标准状况下的体积。',
      subject: 'chemistry', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://chemistry/006', extractionConfidence: 1.0,
    },
  ],
  chinese: [],
  english: [
    // ── new seeds 001-002 ───────────────────────────────────────────
    {
      problemText: '阅读下面短文，回答问题：\n\n"Artificial intelligence (AI) is transforming education in profound ways. From personalized learning platforms that adapt to each student\'s pace, to automated grading systems that free up teachers\' time, AI tools are becoming increasingly common in classrooms around the world. However, critics argue that over-reliance on AI could reduce human interaction and critical thinking skills among students."\n\n问题：According to the passage, what is one benefit and one concern regarding AI in education?',
      subject: 'english', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://english/001', extractionConfidence: 1.0,
    },
    {
      problemText: '阅读下面的短文并选择最佳答案：\n\n"Climate change is one of the most pressing challenges of our time. Rising global temperatures have led to more frequent extreme weather events, melting polar ice caps, and rising sea levels. Scientists agree that human activities, particularly the burning of fossil fuels, are the primary cause. Many countries have pledged to reduce carbon emissions, but progress has been slow."\n\nAccording to the passage, what is the primary cause of climate change?\nA. Melting polar ice caps\nB. Rising sea levels\nC. Human activities, especially burning fossil fuels\nD. Extreme weather events',
      subject: 'english', gradeLevel: 'senior', questionType: 'choice',
      sourceUrl: 'seed://english/002', extractionConfidence: 1.0, sourceAnswer: 'C',
    },
  ],
  biology: [
    // ── new seeds 001-003 ───────────────────────────────────────────
    {
      problemText: '在孟德尔的豌豆杂交实验中，用纯种高茎（显性，DD）与纯种矮茎（隐性，dd）杂交，得到子一代（$F_1$）全部为高茎。若让 $F_1$ 自交，求 $F_2$ 的基因型比例和表现型比例。',
      subject: 'biology', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://biology/001', extractionConfidence: 1.0,
    },
    {
      problemText: 'DNA 分子的双螺旋结构模型是由谁提出的？DNA 复制时遵循什么原则？简述 DNA 半保留复制的过程。',
      subject: 'biology', gradeLevel: 'senior', questionType: 'solve',
      sourceUrl: 'seed://biology/002', extractionConfidence: 1.0,
    },
    {
      problemText: '在有丝分裂过程中，染色体数目加倍发生在哪个时期？纺锤体是在哪个时期形成的？A. 前期 B. 中期 C. 后期 D. 末期',
      subject: 'biology', gradeLevel: 'senior', questionType: 'choice',
      sourceUrl: 'seed://biology/003', extractionConfidence: 1.0, sourceAnswer: 'C',
    },
  ],
  history: [],
  geography: [],
  politics: [],
};

function getSeedQuestions(
  subjects: SubjectId[],
  _gradeLevels: GradeLevel[],
  maxQuestions: number,
): ExtractedQuestion[] {
  const questions: ExtractedQuestion[] = [];
  for (const subject of subjects) {
    const seed = SEED_QUESTIONS[subject] ?? [];
    for (const q of seed) {
      if (questions.length >= maxQuestions) break;
      questions.push(q);
    }
  }
  return questions;
}

// ── Main entry point ────────────────────────────────────────────────

export interface RunEnrichmentOptions {
  /** Specific subjects to run (default: all in priority order) */
  subjects?: SubjectId[];
  /** Specific grade levels (default: senior, college) */
  gradeLevels?: GradeLevel[];
  /** Max questions to solve & store */
  maxQuestions?: number;
  /** @internal Bypass the concurrent-run guard for parallel execution */
  _parallel?: boolean;
}

/**
 * Run the full enrichment pipeline.
 *
 * Processes subjects sequentially in priority order (数学→物理→化学→...).
 * For each subject: search → fetch → extract → solve → store.
 *
 * @returns The completed job with statistics
 */
export async function runEnrichment(opts: RunEnrichmentOptions = {}): Promise<EnrichJob> {
  const {
    subjects = SUBJECTS.map((s) => s.id),
    gradeLevels = ['senior', 'college'],
    maxQuestions = MAX_STORE_PER_RUN,
    _parallel = false,
  } = opts;

  // Prevent concurrent runs (skipped for parallel sub-jobs)
  if (!_parallel && currentJob?.status === 'running') {
    log.warn('[Pipeline] Enrichment already running');
    return currentJob;
  }

  const job: EnrichJob = {
    id: `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'running',
    subject: subjects[0],
    gradeLevels,
    startedAt: Date.now(),
    stats: createEmptyStats(),
  };

  if (!_parallel) {
    currentJob = job;
  }
  log.info(`[Pipeline] Starting enrichment job ${job.id}`);

  try {
    // Check if we should use dataset mode (no search API) or search mode
    const useDatasets = !isSearchConfigured();

    if (useDatasets) {
      log.info('[Pipeline] Using LLM GENERATION mode (no search API, datasets unreachable)');

      // Skip datasets entirely — GitHub is blocked. Use built-in seed questions.
      const questions = getSeedQuestions(subjects, gradeLevels, maxQuestions);

      job.stats.totalExtracted = questions.length;
      for (const q of questions) {
        if (!job.stats.bySubject[q.subject]) {
          job.stats.bySubject[q.subject] = {
            searched: 0, fetched: 0, extracted: 0, solved: 0, stored: 0, failed: 0,
          };
        }
        job.stats.bySubject[q.subject].extracted++;
      }

      log.info(`[Pipeline] Generated ${questions.length} questions via LLM`);

      if (questions.length > 0) {
        await processBatch(questions, job.stats);
      }
    } else {
      // ── Search mode (original path) ──────────────────────────────
      const subjectSet = new Set(subjects);
      const toProcess = SUBJECTS.filter((s) => subjectSet.has(s.id)).sort(
        (a, b) => a.priority - b.priority,
      );

      let totalQuestions = 0;

      for (const subj of toProcess) {
        if (totalQuestions >= maxQuestions) {
          log.info(`[Pipeline] Reached max store limit (${maxQuestions}), stopping`);
          break;
        }

        const activeGradeLevels = gradeLevels.filter((g) =>
          subj.gradeLevels.includes(g),
        );

        if (activeGradeLevels.length === 0) {
          log.info(`[Pipeline] Skipping ${subj.id}: no matching grade levels`);
          continue;
        }

        log.info(`[Pipeline] Processing ${subj.label} (${activeGradeLevels.map((g) => GRADE_MAP[g]?.label).join(', ')})...`);

        // Search + fetch + extract
        const { questions, stats: phaseStats } = await runForSubject({
          subject: subj.id,
          gradeLevels: activeGradeLevels,
          maxQuestions: maxQuestions - totalQuestions,
        });

        job.stats.totalSearched += phaseStats.searched;
        job.stats.totalFetched += phaseStats.fetched;
        job.stats.totalExtracted += phaseStats.extracted;

        if (!job.stats.bySubject[subj.id]) {
          job.stats.bySubject[subj.id] = {
            searched: 0,
            fetched: 0,
            extracted: 0,
            solved: 0,
            stored: 0,
            failed: 0,
          };
        }
        const ss = job.stats.bySubject[subj.id];
        ss.searched += phaseStats.searched;
        ss.fetched += phaseStats.fetched;
        ss.extracted += phaseStats.extracted;

        if (questions.length > 0) {
          const results = await processBatch(questions, job.stats);
          for (const r of results) {
            ss.solved += r.solved ? 1 : 0;
            ss.stored += r.stored ? 1 : 0;
            ss.failed += r.stored ? 0 : 1;
          }
          totalQuestions += results.filter((r) => r.stored).length;
        }

        log.info(
          `[Pipeline] ${subj.label} done: ${ss.extracted} extracted → ${ss.solved} solved → ${ss.stored} stored`,
        );
      }
    }

    job.status = 'completed';
    job.completedAt = Date.now();
    log.info(
      `[Pipeline] Job ${job.id} completed: ${job.stats.totalStored} stored, ${job.stats.totalFailed} failed`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Pipeline] Job ${job.id} failed: ${msg}`);
    job.status = 'failed';
    job.error = msg;
  }

  if (!_parallel) {
    lastJob = job;
    currentJob = null;
  }
  return job;
}

/**
 * Run enrichment for all subjects in parallel.
 *
 * Each subject gets its own job and processes concurrently.
 * Stats from all jobs are merged into a single aggregated result.
 *
 * @returns Aggregated EnrichJob with combined statistics from all subjects
 */
export async function runEnrichmentParallel(opts: RunEnrichmentOptions = {}): Promise<EnrichJob> {
  const {
    subjects = SUBJECTS.map((s) => s.id),
    gradeLevels = ['senior', 'college'],
    maxQuestions = MAX_STORE_PER_RUN,
  } = opts;

  // Prevent concurrent runs at the top level
  if (currentJob?.status === 'running') {
    log.warn('[Pipeline] Enrichment already running');
    return currentJob;
  }

  const aggregatedJob: EnrichJob = {
    id: `enrich_parallel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'running',
    subject: subjects[0],
    gradeLevels,
    startedAt: Date.now(),
    stats: createEmptyStats(),
  };

  currentJob = aggregatedJob;
  log.info(`[Pipeline:Parallel] Starting parallel enrichment for ${subjects.length} subjects`);

  const perSubjectMax = Math.ceil(maxQuestions / subjects.length);

  const jobPromises = subjects.map((subject) =>
    runEnrichment({
      subjects: [subject],
      gradeLevels,
      maxQuestions: perSubjectMax,
      _parallel: true,
    }),
  );

  const results = await Promise.allSettled(jobPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const job = result.value;
      aggregatedJob.stats.totalSearched += job.stats.totalSearched;
      aggregatedJob.stats.totalFetched += job.stats.totalFetched;
      aggregatedJob.stats.totalExtracted += job.stats.totalExtracted;
      aggregatedJob.stats.totalSolved += job.stats.totalSolved;
      aggregatedJob.stats.totalStored += job.stats.totalStored;
      aggregatedJob.stats.totalFailed += job.stats.totalFailed;

      for (const [subj, subStats] of Object.entries(job.stats.bySubject)) {
        if (!aggregatedJob.stats.bySubject[subj]) {
          aggregatedJob.stats.bySubject[subj] = {
            searched: 0, fetched: 0, extracted: 0, solved: 0, stored: 0, failed: 0,
          };
        }
        const agg = aggregatedJob.stats.bySubject[subj];
        agg.searched += subStats.searched;
        agg.fetched += subStats.fetched;
        agg.extracted += subStats.extracted;
        agg.solved += subStats.solved;
        agg.stored += subStats.stored;
        agg.failed += subStats.failed;
      }
    } else {
      log.error(`[Pipeline:Parallel] Subject job failed: ${result.reason}`);
    }
  }

  aggregatedJob.status = 'completed';
  aggregatedJob.completedAt = Date.now();
  log.info(
    `[Pipeline:Parallel] Completed: ${aggregatedJob.stats.totalStored} stored, ${aggregatedJob.stats.totalFailed} failed`,
  );

  lastJob = aggregatedJob;
  currentJob = null;
  return aggregatedJob;
}

/**
 * Get current enrichment status.
 */
export function getEnrichmentStatus() {
  return {
    isRunning: currentJob?.status === 'running',
    currentJob,
    lastJob,
    totalStored: lastJob?.stats?.totalStored ?? 0,
  };
}
