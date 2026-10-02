/**
 * Local-date helpers for the retention module.
 *
 * 所有"日"口径统一用本地时区 YYYY-MM-DD，避免服务端 UTC 与浏览器 UTC+8
 * 在 SSR / 水合阶段产生错配（参考 app/sky/page.tsx 的 getGreeting 先例）。
 */

/** 返回本地时区 YYYY-MM-DD（不读 UTC）。 */
export function toLocalDateStr(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 两个 YYYY-MM-DD 相差的整天数（b - a）。 */
export function diffLocalDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 返回 dateStr 的前一天（本地时区）。 */
export function getYesterdayLocal(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return toLocalDateStr(d);
}
