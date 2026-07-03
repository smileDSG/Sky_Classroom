import { MobileRouteGuard } from '@/components/mobile/mobile-route-guard';

export const metadata = {
  title: '天空课堂 - 移动端',
  description: '天空课堂的移动端首页',
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] justify-center overflow-x-hidden bg-[#020817] text-slate-100">
      <MobileRouteGuard />
      <div className="relative min-h-[100dvh] w-full max-w-[390px] overflow-x-hidden bg-[#07111f] sm:border-x sm:border-white/10 sm:shadow-2xl sm:shadow-black/45">
        {children}
      </div>
    </div>
  );
}
