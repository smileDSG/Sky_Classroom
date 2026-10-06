/**
 * /api/animation/* 客户端响应解包。
 *
 * lib/server/api-response.ts 的响应形状：
 *   成功 → 2xx + `{ success: true, ...data }`（data 顶层平铺，无 data 嵌套）
 *   失败 → 非 2xx + `{ success: false, errorCode, error, details? }`
 * 因此这里不做嵌套提取，只校验 success 标志后透传其余顶层字段。
 */
export async function unwrap<T extends Record<string, unknown>>(res: Response): Promise<T> {
  let json: { success?: boolean; error?: string };
  try {
    json = (await res.json()) as { success?: boolean; error?: string };
  } catch {
    // body 不是 JSON（如网关错误页）
    throw new Error(`请求失败（HTTP ${res.status}）`);
  }
  if (!res.ok || json.success !== true) {
    throw new Error(json.error ?? `请求失败（HTTP ${res.status}）`);
  }
  return json as T;
}
