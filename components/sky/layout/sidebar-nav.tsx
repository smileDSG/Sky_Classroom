'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/hooks/use-i18n';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

function getNavItems(t: (key: string) => string): NavItem[] {
  return [
    { label: t('sky.layout.home'), href: '/sky', icon: '🏠' },
    { label: t('sky.layout.solve'), href: '/sky/solve', icon: '🔍' },
    { label: t('sky.layout.slides'), href: '/sky/slides', icon: '📖' },
    { label: t('sky.layout.learning'), href: '/sky/learning', icon: '📊' },
    { label: t('sky.layout.assistant'), href: '/sky/assistant', icon: '/avatars/kagami/chibi.png' },
  ];
}

interface SkySidebarProps {
  collapsed: boolean;
}

export function SkySidebar({ collapsed }: SkySidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const navItems = getNavItems(t);

  return (
    <aside
      className={`flex flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-52'
      }`}
    >
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
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
                  ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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

      <div className="border-t border-gray-200 p-3 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span className="text-lg">🏫</span>
          {!collapsed && <span>{t('sky.layout.classroomSim')}</span>}
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span className="text-lg">⚙️</span>
          {!collapsed && <span>{t('sky.layout.settings')}</span>}
        </Link>
      </div>
    </aside>
  );
}
