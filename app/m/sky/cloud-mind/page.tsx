import Link from 'next/link';
import {
  BookOpen,
  Brain,
  Camera,
  ChartNoAxesColumnIncreasing,
  FileQuestion,
  GraduationCap,
  Presentation,
  Sparkles,
  Star,
  Telescope,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';

const titleTabs: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}> = [
  { label: '天穹授课', href: '/m/sky', icon: GraduationCap },
  { label: '摘星锦囊', href: '/m/sky/learning/review', icon: Star },
  { label: '云端智囊', href: '/m/sky/cloud-mind', icon: Brain, active: true },
  { label: '天梯工坊', href: '/m/sky/study-lab', icon: ChartNoAxesColumnIncreasing },
  { label: '云翼助手', href: '/m/sky/assistant', icon: Telescope },
];

const tools: Array<{
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  color: string;
  badge?: string;
}> = [
  {
    label: '拍照搜题',
    desc: '拍照识别题目',
    href: '/m/sky/cloud-mind/solve',
    icon: Camera,
    color: 'from-violet-500 to-purple-600',
    badge: '热门',
  },
  {
    label: 'PPT课件',
    desc: '一键生成课件',
    href: '/m/sky/cloud-mind/slides',
    icon: Presentation,
    color: 'from-cyan-500 to-blue-600',
    badge: '推荐',
  },
  {
    label: '智能出题',
    desc: '定制练习题',
    href: '/m/sky/cloud-mind/quiz',
    icon: FileQuestion,
    color: 'from-amber-500 to-orange-500',
    badge: '新',
  },
  {
    label: '记忆卡片',
    desc: '生成复习卡',
    href: '/m/sky/cloud-mind/memory',
    icon: Brain,
    color: 'from-rose-500 to-pink-600',
  },
  {
    label: '智能授课',
    desc: '生成教学方案',
    href: '/m/sky/cloud-mind/teaching',
    icon: BookOpen,
    color: 'from-emerald-500 to-teal-600',
  },
];

export default function MobileCloudMindPage() {
  return (
    <MobileSkyShell>
      <div className="space-y-3 pb-4">
        <nav className="grid grid-cols-5 gap-1 rounded-[18px] border border-white/8 bg-white/[0.04] p-1.5">
          {titleTabs.map((item) => {
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

        <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-4 py-4 shadow-xl shadow-violet-950/20">
          <div className="absolute -right-16 -top-16 size-36 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-14 -left-12 size-32 rounded-full bg-indigo-300/18 blur-2xl" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-white/18">
                <Sparkles className="size-4.5 text-white" />
              </span>
              <span className="text-[12px] font-semibold tracking-[0.18em] text-indigo-100">
                AI 工具集
              </span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-none text-white">云端智囊</h1>
            <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-indigo-100">
              拍照搜题、PPT 课件生成、智能出题、记忆卡片、智能授课，一站直达。
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-indigo-100/85">
              <span>5 大智能工具</span>
              <span className="h-3 w-px bg-white/25" />
              <span>持续更新中</span>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-white/8 bg-white/[0.045] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-white">全部工具</h2>
            <span className="rounded-full bg-white/7 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              5 个入口
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.label}
                  href={tool.href}
                  className={`relative min-h-[78px] overflow-hidden rounded-[18px] border border-white/8 bg-[#132235] p-2.5 active:bg-[#192a40] ${
                    index === tools.length - 1 ? 'col-span-2 min-h-[68px]' : ''
                  }`}
                >
                  <div
                    className={`absolute -right-8 -top-8 size-20 rounded-full bg-gradient-to-br ${tool.color} opacity-25 blur-xl`}
                  />
                  <div className="relative flex items-center gap-2.5">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.color} shadow-lg shadow-black/20`}
                    >
                      <Icon className="size-4.5 text-white" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-bold text-white">{tool.label}</span>
                        {tool.badge && (
                          <span className="rounded-full bg-amber-400/18 px-1.5 py-0.5 text-[8px] font-bold text-amber-200">
                            {tool.badge}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-slate-400">
                        {tool.desc}
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
