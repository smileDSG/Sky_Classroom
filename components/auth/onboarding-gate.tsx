'use client';

// 新用户引导改为「首次进入哪个页面就就地讲解哪个页面」：
// 各页面通过 <PageTour> 各自判断 localstorage 是否已看过，不再全局强制
// 跳转 /sky/onboarding。此组件保留为 no-op，避免变更带入回归；如某天
// 需要恢复全局引导门禁，可在此重写逻辑。
export function sanitizeInternalRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/sky';
  return value;
}

export function OnboardingGate() {
  return null;
}
