'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartNoAxesColumnIncreasing,
  GraduationCap,
  LibraryBig,
  MessageCircleQuestion,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const quickEntrances: {
  icon: LucideIcon;
  title: string;
  href: string;
  color: string;
  exact?: boolean;
  activeHrefs?: string[];
}[] = [
  {
    icon: GraduationCap,
    title: '天空授课',
    href: '/m/sky',
    color: 'text-sky-300 bg-sky-400/12 ring-sky-300/25',
    exact: true,
  },
  {
    icon: LibraryBig,
    title: '云端智囊',
    href: '/m/sky/cloud-mind',
    color: 'text-violet-300 bg-violet-400/12 ring-violet-300/25',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: '天梯工坊',
    href: '/m/sky/study-lab',
    color: 'text-emerald-300 bg-emerald-400/12 ring-emerald-300/25',
  },
  {
    icon: MessageCircleQuestion,
    title: '云翼助手',
    href: '/m/sky/assistant',
    color: 'text-rose-300 bg-rose-400/12 ring-rose-300/25',
  },
  {
    icon: UserRound,
    title: '我的',
    href: '/m/sky/profile',
    color: 'text-cyan-300 bg-cyan-400/12 ring-cyan-300/25',
    activeHrefs: ['/m/account', '/m/settings'],
  },
];

function isActive(pathname: string, href: string, exact?: boolean, activeHrefs?: string[]) {
  if (activeHrefs?.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return true;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileQuickEntranceNav() {
  const pathname = usePathname();
  const [navRoot] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    return document.getElementById('mobile-quick-nav-root');
  });

  const nav = (
    <nav
      aria-label="移动端快捷导航"
      className="mobile-tactile-nav pointer-events-auto w-full rounded-[24px] border border-white/10 bg-[#111d2d]/95 px-2 py-2.5 shadow-2xl shadow-black/35 backdrop-blur-xl"
    >
      <div className="grid grid-cols-5 gap-1">
        {quickEntrances.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, item.exact, item.activeHrefs);

          return (
            <Link
              key={item.title}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 text-center transition-all duration-200 active:scale-[0.96] active:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45',
                active && 'bg-white/8',
              )}
            >
              <span
                className={cn(
                  'mobile-tool-token flex size-9 items-center justify-center rounded-[15px] ring-1',
                  item.color,
                  active && 'bg-white/16',
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span
                className={cn(
                  'w-full truncate text-[12px] font-bold',
                  active ? 'text-white' : 'text-slate-200',
                )}
              >
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return navRoot ? createPortal(nav, navRoot) : nav;
}
