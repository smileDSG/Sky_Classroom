'use client';

import { useI18n } from '@/lib/hooks/use-i18n';

interface SkyTopBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function SkyTopBar({ sidebarCollapsed, onToggleSidebar }: SkyTopBarProps) {
  const { t } = useI18n();

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={sidebarCollapsed ? t('sky.layout.expandSidebar') : t('sky.layout.collapseSidebar')}
        >
          {sidebarCollapsed ? '☰' : '◀'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">☁️</span>
          <h1 className="text-lg font-bold text-[#4A90D9]">{t('sky.layout.skyClassroom')}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={t('sky.layout.toggleTheme')}
        >
          🌙
        </button>
        <div className="h-8 w-8 rounded-full bg-[#4A90D9]/20 flex items-center justify-center text-sm text-[#4A90D9] font-semibold">
          👤
        </div>
      </div>
    </header>
  );
}
