'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: '首页', href: '/sky', icon: '🏠' },
  { label: '搜题', href: '/sky/solve', icon: '🔍' },
  { label: '幻灯片', href: '/sky/cloud-mind/slides', icon: '📖' },
  { label: '学习数据', href: '/sky/learning', icon: '📊' },
  { label: '小镜课堂', href: '/sky/assistant', icon: '/avatars/kagami/chibi.png' },
];

interface SkySidebarProps {
  collapsed: boolean;
}

export function SkySidebar({ collapsed }: SkySidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-52'
      }`}
    >
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/sky'
              ? pathname === '/sky'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA] font-semibold'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-lg leading-none">
                {item.icon.startsWith('/') ? (
                  <img src={item.icon} className="h-5 w-5 rounded-full object-cover" alt="" />
                ) : (
                  item.icon
                )}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 dark:border-slate-700 p-3 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-200"
        >
          <span className="text-lg">🏫</span>
          {!collapsed && <span>课堂模拟</span>}
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-200"
        >
          <span className="text-lg">⚙️</span>
          {!collapsed && <span>设置</span>}
        </Link>
      </div>
    </aside>
  );
}
