import { clearQuestionBank } from '@/lib/solve/question-bank';
import { clearSolveCache } from '@/lib/solve/solve-cache';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SolveClear');

export async function POST() {
  const results: string[] = [];

  // Clear solve cache (in-memory, always works)
  try {
    await clearSolveCache();
    results.push('缓存已清空');
  } catch (err) {
    log.warn('[SolveClear] Cache clear failed:', err);
  }

  // Clear question bank (MySQL, may fail if not configured)
  try {
    await clearQuestionBank();
    results.push('题库已清空');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('[SolveClear] Question bank clear failed (MySQL may not be running):', msg);
    results.push('题库清空跳过(MySQL未连接)');
  }

  log.info('[SolveClear] Done:', results.join(', '));
  return Response.json({ success: true, results });
}
