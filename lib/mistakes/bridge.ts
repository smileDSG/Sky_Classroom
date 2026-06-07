/**
 * Bridge: syncs main-app quiz grading results → sky classroom mistake store.
 *
 * Reads from the main app's localStorage quiz persistence (which is written
 * by quiz-view.tsx — NOT our code) and the stage store (scene data), converts
 * incorrect answers to MistakeRecords, and pushes them into the sky classroom
 * store + IndexedDB.
 *
 * This file ONLY modifies sky-classroom state. It does not touch any main-app
 * file. Call `syncMistakesFromQuizzes()` on the learning page mount.
 */

import type { QuizQuestion } from '@/lib/types/stage';
import type { QuestionResult } from '@/lib/quiz/grading';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { analyzeMistakeCause } from '@/lib/mistakes/cause-analyzer';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useStageStore } from '@/lib/store/stage';
import { createLogger } from '@/lib/logger';

const log = createLogger('MistakeBridge');

// localStorage keys used by the main app (lib/quiz/persistence.ts)
const RESULTS_KEY_PREFIX = 'quizResults:';
const ANSWERS_KEY_PREFIX = 'quizAnswers:';

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function formatAnswer(arr: string[]): string {
  if (arr.length === 0) return '(未作答)';
  return arr.join(', ');
}

function guessKnowledgePoints(question: string): string[] {
  const kps: string[] = [];
  const text = question.toLowerCase();
  if (/方程|未知数|解|函数|代数|多项式/.test(text)) kps.push('代数');
  if (/三角|几何|面积|周长|圆|角|图形|坐标/.test(text)) kps.push('几何');
  if (/概率|统计|平均数|方差|排列|组合/.test(text)) kps.push('概率与统计');
  if (/力|速度|加速度|电|磁|光|热|能量|功/.test(text)) kps.push('物理');
  if (/反应|化学|元素|分子|原子|方程式|酸碱/.test(text)) kps.push('化学');
  if (/阅读|翻译|语法|时态|词汇|作文|写作/.test(text)) kps.push('语言');
  return kps.length > 0 ? kps : ['综合'];
}

/** Scan all sceneIds that have quiz results in localStorage. */
function getCompletedSceneIds(): string[] {
  if (typeof window === 'undefined') return [];
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(RESULTS_KEY_PREFIX)) {
      ids.push(key.slice(RESULTS_KEY_PREFIX.length));
    }
  }
  return ids;
}

/**
 * Sync mistakes from all completed quizzes into the sky classroom store.
 * Call this on the learning page mount. Idempotent — won't duplicate records.
 */
export function syncMistakesFromQuizzes(): void {
  if (typeof window === 'undefined') return;

  const store = useSkyClassroomStore.getState();
  const existingIds = new Set(store.mistakes.map((m) => m.id));

  // Get all scenes from the stage store (main app's data)
  const stageScenes = useStageStore.getState().scenes;

  const sceneIds = getCompletedSceneIds();
  if (sceneIds.length === 0) return;

  let synced = 0;

  for (const sceneId of sceneIds) {
    // Read quiz results from localStorage (written by main app)
    const rawResults = localStorage.getItem(RESULTS_KEY_PREFIX + sceneId);
    const rawAnswers = localStorage.getItem(ANSWERS_KEY_PREFIX + sceneId);
    if (!rawResults || !rawAnswers) continue;

    let results: QuestionResult[];
    let answers: Record<string, string | string[]>;
    try {
      results = JSON.parse(rawResults);
      answers = JSON.parse(rawAnswers);
    } catch {
      continue;
    }
    if (!Array.isArray(results)) continue;

    // Find the scene that contains quiz questions
    const scene = stageScenes.find((s) => s.id === sceneId);
    const questions: QuizQuestion[] =
      scene?.content?.type === 'quiz'
        ? (scene.content as { questions: QuizQuestion[] }).questions ?? []
        : [];

    for (const r of results) {
      if (r.status !== 'incorrect') continue;

      const q = questions.find((q) => q.id === r.questionId);
      if (!q) continue;

      const recordId = `quiz-${sceneId}-${q.id}`;
      if (existingIds.has(recordId)) continue;

      const userAnswer = formatAnswer(toArray(answers[q.id]));
      const correctAnswer = formatAnswer(toArray(q.answer));
      const cause = analyzeMistakeCause(q.question, correctAnswer, userAnswer);

      const record: MistakeRecord = {
        id: recordId,
        problem: q.question,
        userAnswer,
        correctAnswer,
        cause,
        solvedAt: new Date(),
        reviewed: false,
        reviewCount: 0,
        knowledgePoints: guessKnowledgePoints(q.question),
      };

      store.addMistake(record);
      existingIds.add(recordId);
      synced++;
    }
  }

  if (synced > 0) {
    log.info(`Synced ${synced} new mistakes from ${sceneIds.length} quiz scene(s)`);
  }
}
