/**
 * Seed real mistake data into the Zustand store (browser-side only).
 * Replaces old "1+1=?" fake data with realistic exam-style mistakes.
 * Clears ALL data sources: IndexedDB, localStorage, quiz traces, Zustand.
 *
 * Run in browser console:
 *   import('@/scripts/seed-mistakes').then(m => m.seedMistakes())
 */
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

/** Keys that `syncMistakesFromQuizzes` reads from localStorage */
const QUIZ_RESULT_PREFIX = 'quizResults:';
const QUIZ_ANSWER_PREFIX = 'quizAnswers:';

/**
 * Clear ALL localStorage keys related to quizzes and mistakes.
 */
function clearAllQuizTraces(): void {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith(QUIZ_RESULT_PREFIX) ||
      key.startsWith(QUIZ_ANSWER_PREFIX) ||
      key.startsWith('mistake:') ||
      key.startsWith('sky-')
    ) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  if (keysToRemove.length > 0) {
    console.log(`[seed-mistakes] Cleared ${keysToRemove.length} keys from localStorage`);
  }
}

/**
 * Clear the IndexedDB `mistakes` store directly.
 * This ensures the server API won't pull old data back.
 */
async function clearIndexedDBMistakes(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;

  return new Promise((resolve) => {
    const request = indexedDB.open('SkyClassroomDB');
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('mistakes')) {
        db.close();
        console.log('[seed-mistakes] IndexedDB mistakes store not found, skipping');
        resolve(0);
        return;
      }
      const tx = db.transaction('mistakes', 'readwrite');
      const store = tx.objectStore('mistakes');
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        store.clear();
        tx.oncomplete = () => {
          db.close();
          console.log(`[seed-mistakes] Cleared ${count} entries from IndexedDB mistakes`);
          resolve(count);
        };
        tx.onerror = () => {
          db.close();
          console.error('[seed-mistakes] Failed to clear IndexedDB mistakes');
          resolve(0);
        };
      };
      countRequest.onerror = () => {
        db.close();
        resolve(0);
      };
    };
    request.onerror = () => {
      console.warn('[seed-mistakes] Could not open IndexedDB');
      resolve(0);
    };
  });
}

/**
 * Seed directly into Zustand store (client-side only).
 * Clears ALL data sources, then adds real mistakes.
 */
export async function seedMistakes(): Promise<{ added: number }> {
  if (typeof window === 'undefined') {
    throw new Error('seedMistakes can only run in the browser');
  }

  const set = useSkyClassroomStore.setState;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  console.log('[seed-mistakes] Starting seed process...');

  // Step 1: Clear IndexedDB mistakes store (prevents API from pulling old data back)
  const indexedDBCleared = await clearIndexedDBMistakes();

  // Step 2: Clear ALL localStorage traces
  clearAllQuizTraces();

  // Step 3: Clear localStorage Zustand persistence
  localStorage.removeItem('sky-classroom-storage');
  console.log('[seed-mistakes] Cleared sky-classroom-storage from localStorage');

  // Step 4: Reset Zustand store
  set({ mistakes: [] });
  console.log('[seed-mistakes] Reset Zustand mistakes to empty');

  // Step 5: Build 15 real exam questions
  const REAL_MISTAKES: MistakeRecord[] = [
    {
      id: `real-1-${now}`,
      problem:
        '已知二次函数 y = ax² + bx + c 的图象经过点 (1, 0)、(-1, 4) 和 (2, 3)，求 a、b、c 的值。',
      userAnswer: 'a=1, b=0, c=-1',
      correctAnswer: 'a=1, b=-2, c=1',
      cause: 'concept-unclear',
      solvedAt: new Date(now - 1 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['二次函数', '待定系数法'],
      source: 'solve',
    },
    {
      id: `real-2-${now}`,
      problem: '在三角形 ABC 中，已知 AB=5, BC=6, AC=7，求角B 的余弦值。',
      userAnswer: 'cos B = 1/2',
      correctAnswer: 'cos B = 1/5',
      cause: 'calculation-error',
      solvedAt: new Date(now - 2 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['余弦定理', '三角形'],
      source: 'solve',
    },
    {
      id: `real-3-${now}`,
      problem: '解不等式组：2x - 3 > 5 且 x + 1 ≤ 4，求 x 的取值范围。',
      userAnswer: 'x > 4',
      correctAnswer: '无解',
      cause: 'careless',
      solvedAt: new Date(now - 3 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['不等式', '不等式组'],
      source: 'solve',
    },
    {
      id: `real-4-${now}`,
      problem: '已知函数 f(x) = x³ - 3x² + 2x，求 f(x) 的极值点及极值。',
      userAnswer: '极大值点 x=2/3，极大值 4/27',
      correctAnswer: '极大值点 x=0, 极大值 0；极小值点 x=2, 极小值 -4',
      cause: 'method-wrong',
      solvedAt: new Date(now - 4 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['导数', '极值', '函数'],
      source: 'solve',
    },
    {
      id: `real-5-${now}`,
      problem: '从 5 名男生和 4 名女生中选出 3 人组成小组，要求至少有 1 名女生，问有多少种选法？',
      userAnswer: 'C(4,1) × C(8,2) = 112',
      correctAnswer: 'C(9,3) - C(5,3) = 74',
      cause: 'method-wrong',
      solvedAt: new Date(now - 5 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['排列组合', '概率'],
      source: 'solve',
    },
    {
      id: `real-6-${now}`,
      problem: '已知等差数列 {an} 的前 n 项和 Sn = 3n² + 2n，求通项公式 an。',
      userAnswer: 'an = 3n + 2',
      correctAnswer: 'an = 6n - 1',
      cause: 'calculation-error',
      solvedAt: new Date(now - 6 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['等差数列', '数列求和'],
      source: 'solve',
    },
    {
      id: `real-7-${now}`,
      problem:
        '已知直线 l1: 3x + 4y - 5 = 0 与直线 l2: 6x + 8y + c = 0 平行，且两直线之间的距离为 2，求 c 的值。',
      userAnswer: 'c = 5',
      correctAnswer: 'c = 15 或 c = -25',
      cause: 'misreading',
      solvedAt: new Date(now - 7 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['直线方程', '点到直线距离'],
      source: 'solve',
    },
    {
      id: `real-8-${now}`,
      problem: '求曲线 y = x² 在点 (1, 1) 处的切线方程。',
      userAnswer: 'y = x',
      correctAnswer: 'y = 2x - 1',
      cause: 'concept-unclear',
      solvedAt: new Date(now - 8 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['导数', '切线方程'],
      source: 'solve',
    },
    {
      id: `real-9-${now}`,
      problem: '已知随机变量 X ~ B(10, 0.3)，求 E(X) 和 D(X)。',
      userAnswer: 'E(X) = 0.3, D(X) = 0.21',
      correctAnswer: 'E(X) = 3, D(X) = 2.1',
      cause: 'careless',
      solvedAt: new Date(now - 9 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['二项分布', '期望', '方差'],
      source: 'solve',
    },
    {
      id: `real-10-${now}`,
      problem: '在空间直角坐标系中，已知点 A(1, 2, 3) 和点 B(4, 5, 6)，求向量 AB 的模和方向余弦。',
      userAnswer: '|AB| = 根号27, cosα=3/根号27',
      correctAnswer: '|AB| = 3根号3, cosα=1/根号3, cosβ=1/根号3, cosγ=1/根号3',
      cause: 'calculation-error',
      solvedAt: new Date(now - 10 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['空间向量', '方向余弦'],
      source: 'solve',
    },
    {
      id: `real-11-${now}`,
      problem: '已知椭圆的焦点在 x 轴上，焦距为 4，离心率为 1/2，求椭圆的标准方程。',
      userAnswer: 'x²/4 + y²/3 = 1',
      correctAnswer: 'x²/16 + y²/12 = 1',
      cause: 'concept-unclear',
      solvedAt: new Date(now - 11 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['椭圆', '离心率'],
      source: 'solve',
    },
    {
      id: `real-12-${now}`,
      problem: '求定积分 (0到1) (x² + 2x + 1) dx 的值。',
      userAnswer: '1/3 + 1 + 1 = 7/3',
      correctAnswer: '7/3',
      cause: 'careless',
      solvedAt: new Date(now - 12 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['定积分', '积分计算'],
      source: 'solve',
    },
    {
      id: `real-13-${now}`,
      problem: '已知复数 z 满足 |z - 1| = |z - i|，求 z 在复平面上对应点的轨迹方程。',
      userAnswer: 'x² = y²',
      correctAnswer: 'x = y',
      cause: 'method-wrong',
      solvedAt: new Date(now - 13 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['复数', '轨迹方程'],
      source: 'solve',
    },
    {
      id: `real-14-${now}`,
      problem: '在三角形 ABC 中，已知 a=3, b=4, c=5，判断三角形的形状并求其内切圆半径。',
      userAnswer: '锐角三角形，r = 2',
      correctAnswer: '直角三角形，r = 1',
      cause: 'calculation-error',
      solvedAt: new Date(now - 14 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['三角形', '内切圆'],
      source: 'solve',
    },
    {
      id: `real-15-${now}`,
      problem: '已知函数 f(x) = log2(x² - 3x + 2)，求 f(x) 的定义域。',
      userAnswer: 'x > 1 且 x < 2',
      correctAnswer: '(-∞, 1) ∪ (2, +∞)',
      cause: 'concept-unclear',
      solvedAt: new Date(now - 15 * DAY),
      reviewed: false,
      reviewCount: 0,
      masteryLevel: 0,
      knowledgePoints: ['对数函数', '定义域'],
      source: 'solve',
    },
  ];

  // Step 6: Set all mistakes at once
  set({ mistakes: REAL_MISTAKES });

  // Step 7: Write to localStorage persistence (so it survives reload)
  const persistedState = {
    state: {
      mistakes: REAL_MISTAKES,
    },
    version: 2,
  };
  localStorage.setItem('sky-classroom-storage', JSON.stringify(persistedState));
  console.log('[seed-mistakes] Wrote new data to localStorage persistence');

  console.log('[seed-mistakes] Done! Added ${REAL_MISTAKES.length} real mistakes.');
  console.log('[seed-mistakes] Please refresh the page (F5) to see the changes.');

  // Prevent quiz sync from re-adding fake "1+1=?" data on next page load
  sessionStorage.setItem('sky-skip-quiz-sync', '1');

  return { added: REAL_MISTAKES.length };
}
