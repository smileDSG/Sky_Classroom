'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: '首页', href: '/', icon: '🏠' },
  { label: '概况', href: '/sky', icon: '📋' },
  { label: '搜题', href: '/sky/solve', icon: '🔍' },
  { label: '幻灯片', href: '/sky/slides', icon: '📖' },
  { label: '学习数据', href: '/sky/learning', icon: '📊' },
  { label: '小镜', href: '/sky/assistant', icon: '/avatars/kagami/chibi.png' },
];

export function SkyTabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto whitespace-nowrap shrink-0">
      {NAV_ITEMS.map((item) => {
        let isActive: boolean;
        if (item.href === '/') {
          isActive = pathname === '/' || pathname.startsWith('/classroom/') || pathname.startsWith('/generation');
        } else if (item.href === '/sky') {
          isActive = pathname === '/sky';
        } else {
          isActive = pathname.startsWith(item.href);
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none">
              {item.icon.startsWith('/') ? (
                <img src={item.icon} className="h-5 w-5 rounded-full object-cover" alt="" />
              ) : (
                item.icon
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
