'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck,
  ChevronRight,
  FileQuestion,
  Flame,
  GraduationCap,
  KeyRound,
  LogIn,
  LogOut,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileThemeControl } from '@/components/mobile/mobile-theme-control';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { useAuth } from '@/components/auth/auth-provider';

function formatRole(role?: string) {
  if (role === 'admin') return '管理员';
  if (role === 'user') return '学习者';
  if (role === 'guest') return '访客';
  return '未登录';
}

function formatDate(timestamp?: number) {
  if (!timestamp) return '暂未记录';
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const learningStats = [
  { label: '今日学习', value: '28 分钟', icon: Flame },
  { label: '待复习', value: '6 题', icon: CalendarCheck },
  { label: '掌握度', value: '82%', icon: BadgeCheck },
];

const learningActions = [
  {
    href: '/m/sky/learning/profile',
    icon: GraduationCap,
    label: '学习画像',
    desc: '查看掌握度和路径建议',
  },
  {
    href: '/m/sky/learning/mistakes',
    icon: FileQuestion,
    label: '错题本',
    desc: '回看薄弱点和复习记录',
  },
  {
    href: '/m/sky/learning/review',
    icon: BookOpenCheck,
    label: '复习计划',
    desc: '处理今天到期的任务',
  },
];

export default function MobileProfilePage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const userInitial = user?.username?.slice(0, 1).toUpperCase() ?? '未';

  const handleLogout = async () => {
    await logout();
    router.push('/m/auth/login?redirect=%2Fm%2Fsky');
  };

  if (isLoading) {
    return (
      <MobileSkyShell fullBleed>
        <div className="flex min-h-[70dvh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        </div>
      </MobileSkyShell>
    );
  }

  return (
    <MobileSkyShell fullBleed>
      <div className="relative flex flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-cyan-600/25 via-indigo-600/15 to-transparent" />

        <section className="relative px-5 pb-6 pt-9">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="text-[12px] font-semibold tracking-[0.2em] text-white/90">
              个人中心
            </span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/12 text-[26px] font-black text-cyan-100 ring-1 ring-cyan-200/20">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-extrabold leading-tight text-white">
                  {user ? user.username : '个人中心'}
                </h1>
                {user && <BadgeCheck className="size-5 shrink-0 text-cyan-200" />}
              </div>
              <p className="mt-1 truncate text-sm font-medium text-slate-300">
                {user ? formatRole(user.role) : '登录后同步学习数据'}
              </p>
            </div>
          </div>
        </section>

        <div className="relative space-y-4 px-4 pb-24">
          {!user ? (
          <section className="rounded-2xl border border-white/10 bg-[#0d1728] p-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
              <LogIn className="size-5" />
            </div>
            <h2 className="mt-3 text-lg font-extrabold text-white">请先登录</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              登录后可同步课堂、错题和个性化学习设置。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href="/m/auth/login?redirect=%2Fm%2Fsky%2Fprofile"
                className="flex h-11 items-center justify-center rounded-xl bg-cyan-300 text-sm font-extrabold text-slate-950"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-sm font-extrabold text-white"
              >
                注册
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-[#0d1728] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
              <SectionTitle icon={Flame} title="学习数据" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {learningStats.map((item) => (
                  <LearningStat key={item.label} {...item} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ProfileStat label="套餐" value={user?.planType ?? 'free'} />
                <ProfileStat label="加入" value={formatDate(user?.createdAt)} />
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <SectionTitle icon={Sparkles} title="学习入口" />
              <div className="mt-3 space-y-2">
                {learningActions.map((action) => (
                  <ProfileAction key={action.href} {...action} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <SectionTitle icon={Palette} title="显示设置" />
              <MobileThemeControl className="mt-3 w-full" />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <SectionTitle icon={ShieldCheck} title="账户与安全" />
              <div className="mt-3 space-y-2">
                <ProfileAction
                  href="/m/account"
                  icon={KeyRound}
                  label="账户安全"
                  desc="资料、密码和订阅信息"
                />
                <ProfileAction
                  href="/m/settings"
                  icon={SlidersHorizontal}
                  label="完整设置"
                  desc="供应商、导出和系统配置"
                />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-rose-200/15 bg-rose-300/10 px-3 text-left text-sm font-extrabold text-rose-100"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="size-4" />
                    退出登录
                  </span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </section>
          </>
        )}
      </div>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-base font-extrabold text-white">
        <Icon className="size-4 text-cyan-200" />
        {title}
      </div>
      {aside && (
        <span className="rounded-full bg-white/7 px-2 py-1 text-[12px] font-bold text-slate-400">
          {aside}
        </span>
      )}
    </div>
  );
}

function LearningStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-2 py-2.5 text-center">
      <Icon className="mx-auto size-4 text-cyan-200" />
      <div className="mt-1 truncate text-sm font-extrabold text-white">{value}</div>
      <div className="mt-0.5 truncate text-[12px] font-bold text-slate-400">{label}</div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <div className="truncate text-sm font-extrabold text-white">{value}</div>
      <div className="mt-0.5 truncate text-[12px] font-bold text-slate-400">{label}</div>
    </div>
  );
}

function ProfileAction({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d1728] px-3 py-2 text-white"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-100">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold">{label}</span>
          <span className="mt-0.5 block truncate text-[13px] font-medium text-slate-400">{desc}</span>
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-500" />
    </Link>
  );
}
