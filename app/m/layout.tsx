import { MobileRouteGuard } from '@/components/mobile/mobile-route-guard';
import { MobileAIFloatingButton } from '@/components/mobile/mobile-ai-floating-button';
import { KagamiPanel } from '@/components/ai/kagami-panel';

export const metadata = {
  title: '天空课堂 - 移动端',
  description: '天空课堂移动端',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-theme-shell flex min-h-[100dvh] justify-center overflow-x-hidden bg-[#020817] text-slate-100 antialiased">
      <MobileRouteGuard />
      <div
        aria-label="移动端内容容器"
        className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 sm:max-w-[390px] sm:rounded-[2.35rem] sm:border-x sm:border-white/10 sm:shadow-2xl sm:shadow-black/45"
      >
        <div className="mobile-theme-surface scrollbar-hide relative flex min-h-[100dvh] w-full flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[#07111f] sm:[clip-path:inset(0_round_1.85rem)]">
          {children}
        </div>
        <div
          id="mobile-quick-nav-root"
          className="mobile-theme-surface pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.85rem)] z-[80] px-4"
        />
        <MobileAIFloatingButton />
        <KagamiPanel mobile />
      </div>
    </div>
  );
}
