/**
 * 错题列表查询参数解析回归测试。
 *
 * 背景 bug：GET /api/sky/mistakes 曾把缺省参数当成 0 传下去——
 *   Number.isFinite(Number(null)) === true（因为 Number(null) === 0）
 * 于是 dao 收到 masteryBelow: 0，按 `masteryLevel < 0` 过滤，
 * 把所有错题都滤掉，表现为「错题本永远为空」。
 *
 * 本测试直接锁定解析规则：缺省/空串→ undefined（不过滤），
 * 显式传数字 → 按数字过滤。
 */

/** 复刻 app/api/sky/mistakes/route.ts GET 的参数解析逻辑 */
function parseListQuery(search: URLSearchParams) {
  const errorType = search.get('errorType') as string | null;
  const reviewed = search.get('reviewed');
  const masteryBelow = search.get('masteryBelow');
  const page = search.get('page');
  const pageSize = search.get('pageSize');

  return {
    errorType: errorType ?? undefined,
    reviewed: reviewed !== null ? reviewed === 'true' : undefined,
    masteryBelow:
      masteryBelow !== null && masteryBelow.trim() !== '' && Number.isFinite(Number(masteryBelow))
        ? Number(masteryBelow)
        : undefined,
    page:
      page !== null && Number.isFinite(Number(page)) ? Math.max(1, Math.trunc(Number(page))) : 1,
    pageSize:
      pageSize !== null && pageSize.trim() !== ''
        ? Math.min(100, Math.max(1, Math.trunc(Number(pageSize))))
        : 20,
  };
}

/** 复刻 dao.list 对 masteryBelow 的过滤语义 */
function applyMasteryFilter<T extends { masteryLevel: number }>(items: T[], below?: number): T[] {
  if (below === undefined) return items;
  return items.filter((e) => e.masteryLevel < below);
}

const SAMPLE = [
  { id: 'm1', masteryLevel: 0 },
  { id: 'm2', masteryLevel: 3 },
  { id: 'm3', masteryLevel: 5 },
];

describe('GET /api/sky/mistakes 查询参数解析', () => {
  it('缺省参数不传 masteryBelow → 不过滤，返回全部', () => {
    const q = parseListQuery(new URLSearchParams(''));
    expect(q.masteryBelow).toBeUndefined();
    expect(applyMasteryFilter(SAMPLE, q.masteryBelow)).toHaveLength(3);
  });

  it('回归：空查询串不会把全部错题滤空（历史 bug）', () => {
    const q = parseListQuery(new URLSearchParams());
    expect(applyMasteryFilter(SAMPLE, q.masteryBelow)).toEqual(SAMPLE);
  });

  it('空串参数按缺省处理，不当0', () => {
    const q = parseListQuery(new URLSearchParams('masteryBelow='));
    expect(q.masteryBelow).toBeUndefined();
    expect(applyMasteryFilter(SAMPLE, q.masteryBelow)).toHaveLength(3);
  });

  it('显式传 masteryBelow=5 → 按 <5 过滤', () => {
    const q = parseListQuery(new URLSearchParams('masteryBelow=5'));
    expect(q.masteryBelow).toBe(5);
    expect(applyMasteryFilter(SAMPLE, q.masteryBelow).map((x) => x.id)).toEqual(['m1', 'm2']);
  });

  it('显式传 masteryBelow=0 → 结果为空（这是用户本意，不是 bug）', () => {
    const q = parseListQuery(new URLSearchParams('masteryBelow=0'));
    expect(q.masteryBelow).toBe(0);
    expect(applyMasteryFilter(SAMPLE, q.masteryBelow)).toHaveLength(0);
  });

  it('非数字参数按缺省处理', () => {
    const q = parseListQuery(new URLSearchParams('masteryBelow=abc'));
    expect(q.masteryBelow).toBeUndefined();
  });

  it('reviewed 缺省为 undefined，显式 true/false 正确解析', () => {
    expect(parseListQuery(new URLSearchParams('')).reviewed).toBeUndefined();
    expect(parseListQuery(new URLSearchParams('reviewed=true')).reviewed).toBe(true);
    expect(parseListQuery(new URLSearchParams('reviewed=false')).reviewed).toBe(false);
  });

  it('page缺省为 1，pageSize 缺省为 20 且上限 100', () => {
    expect(parseListQuery(new URLSearchParams('')).page).toBe(1);
    expect(parseListQuery(new URLSearchParams('')).pageSize).toBe(20);
    expect(parseListQuery(new URLSearchParams('pageSize=999')).pageSize).toBe(100);
    expect(parseListQuery(new URLSearchParams('page=0')).page).toBe(1);
  });
});
