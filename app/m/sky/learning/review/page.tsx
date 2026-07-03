import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Brain,
  CalendarClock,
  Camera,
  ChartNoAxesColumnIncreasing,
  GraduationCap,
  Moon,
  Presentation,
  Star,
  Telescope,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';

const tabs: Array<{ label: string; href: string; icon: LucideIcon; active?: boolean }> = [
  { label: '天穹授课', href: '/m/sky', icon: GraduationCap },
  { label: '摘星锦囊', href: '/m/sky/learning/review', icon: Star, active: true },
  { label: '云端智囊', href: '/m/sky/cloud-mind', icon: Brain },
  { label: '天梯工坊', href: '/m/sky/study-lab', icon: ChartNoAxesColumnIncreasing },
  { label: '云翼助手', href: '/m/sky/assistant', icon: Telescope },
];

const startActions: Array<{
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  tone: string;
  iconTone: string;
}> = [
  {
    label: '拍照搜题',
    desc: '拍题自动识别并解析',
    href: '/m/sky/cloud-mind/solve',
    icon: Camera,
    tone: 'from-sky-400/18 via-[#10253d]/55 to-[#0d1728]',
    iconTone: 'bg-sky-400/14 text-sky-100 ring-sky-200/25 shadow-sky-500/15',
  },
  {
    label: '生成课件',
    desc: 'AI 自动生成精美 PPT',
    href: '/m/sky/cloud-mind/slides',
    icon: Presentation,
    tone: 'from-cyan-400/16 via-[#0d2b34]/55 to-[#0d1728]',
    iconTone: 'bg-cyan-400/14 text-cyan-100 ring-cyan-200/25 shadow-cyan-500/15',
  },
  {
    label: 'AI 助手',
    desc: '智能答疑与知识讲解',
    href: '/m/sky/assistant?view=chat',
    icon: Bot,
    tone: 'from-violet-400/18 via-[#211f45]/55 to-[#0d1728]',
    iconTone: 'bg-violet-400/14 text-violet-100 ring-violet-200/25 shadow-violet-500/15',
  },
  {
    label: '复习计划',
    desc: '基于艾宾浩斯记忆曲线',
    href: '/m/sky/learning/review/plan',
    icon: CalendarClock,
    tone: 'from-emerald-400/16 via-[#103530]/55 to-[#0d1728]',
    iconTone: 'bg-emerald-400/14 text-emerald-100 ring-emerald-200/25 shadow-emerald-500/15',
  },
];

export default function MobileReviewPage() {
  return (
    <MobileSkyShell>
      <div className="space-y-2.5 pb-4">
        <nav className="grid grid-cols-5 gap-1 rounded-[18px] border border-white/8 bg-white/[0.04] p-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-[14px] px-1 py-1.5 text-center ${
                  item.active
                    ? 'bg-white/10 text-white ring-1 ring-sky-300/25'
                    : 'text-slate-400 active:bg-white/7'
                }`}
              >
                <Icon className={`size-3.5 ${item.active ? 'text-sky-300' : 'text-slate-500'}`} />
                <span className="w-full truncate text-[10px] font-semibold leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <section className="rounded-[18px] border border-white/8 bg-[#101a2b] px-3.5 py-3 shadow-lg shadow-slate-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[13px] bg-indigo-500/16 text-indigo-200">
                <Moon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[19px] font-extrabold leading-tight text-white">
                  下午好，同学！
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
                  开始你的第一道练习吧！
                </span>
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/8 bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-slate-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              学习中
            </span>
          </div>
        </section>

        <section className="rounded-[20px] border border-white/8 bg-[#101a2b] p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[17px] bg-indigo-500/16 text-indigo-200">
              <Star className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-400">新手起步</div>
              <h1 className="mt-0.5 truncate text-[18px] font-extrabold text-white">
                欢迎来到摘星锦囊
              </h1>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">
                先完成一道练习，系统会在这里汇总错题、趋势和下一步建议。
              </p>
            </div>
          </div>
          <Link
            href="/m/sky/cloud-mind/solve"
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[#563cff] px-3 text-[13px] font-extrabold text-white shadow-lg shadow-indigo-950/30 active:scale-[0.99]"
          >
            <Camera className="size-4" />
            拍照搜题开始学习
            <ArrowRight className="size-4" />
          </Link>
        </section>

        <section aria-label="核心学习入口">
          <div className="grid grid-cols-2 gap-2.5">
            {startActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group relative min-h-[88px] overflow-hidden rounded-[20px] border border-white/10 bg-[#0d1728] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.99]"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${action.tone} opacity-100`}
                  />
                  <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="absolute -right-10 -top-12 size-28 rounded-full bg-white/8 blur-2xl" />
                  <div className="absolute -bottom-14 left-2 size-24 rounded-full bg-slate-950/35 blur-2xl" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`flex size-11 shrink-0 items-center justify-center rounded-[15px] ring-1 shadow-lg backdrop-blur ${action.iconTone}`}
                      >
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.055] text-slate-400 shadow-inner shadow-white/5 backdrop-blur transition-colors group-active:text-white">
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                    <span className="mt-3 min-w-0">
                      <span className="block truncate text-[16px] font-extrabold leading-tight text-white">
                        {action.label}
                      </span>
                      <span className="mt-1.5 block truncate text-[11px] font-semibold text-slate-400">
                        {action.desc}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </MobileSkyShell>
  );
}
