'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: '首页', href: '/', icon: '🏠' },
  { label: '概况', href: '/sky', icon: '📋' },
  { label: '搜题', href: '/sky/solve', icon: '🔍' },
  { label: '幻灯片', href: '/sky/slides', icon: '📖' },
  { label: '学习数据', href: '/sky/learning', icon: '📊' },
  { label: 'AI 助手', href: '/sky/assistant', icon: '💡' },
];

export function SkyTabBar() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        let isActive: boolean;
        if (item.href === '/') {
          // Root: active when on /, /classroom/*, /generation/*
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
                ? 'bg-[#4A90D9]/10 text-[#4A90D9]'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
