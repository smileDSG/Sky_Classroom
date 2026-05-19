'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/sky', icon: '🏠' },
  { label: '搜题', href: '/sky/solve', icon: '🔍' },
  { label: '幻灯片', href: '/sky/slides', icon: '📖' },
  { label: '学习数据', href: '/sky/learning', icon: '📊' },
  { label: 'AI 助手', href: '/sky/assistant', icon: '💡' },
];

interface SkySidebarProps {
  collapsed: boolean;
}

export function SkySidebar({ collapsed }: SkySidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
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
                  ? 'bg-[#4A90D9]/10 text-[#4A90D9] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-3 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span className="text-lg">🏫</span>
          {!collapsed && <span>课堂模拟</span>}
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span className="text-lg">⚙️</span>
          {!collapsed && <span>设置</span>}
        </Link>
      </div>
    </aside>
  );
}
