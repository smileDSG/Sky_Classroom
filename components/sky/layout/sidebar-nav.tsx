'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  ChevronRight,
  FlaskConical,
  Home,
  LibraryBig,
  PanelLeft,
  PanelLeftClose,
  Presentation,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SECTION_GROUPS, type SkySection } from './sky-section-nav';
import { cn } from '@/lib/utils';

const SECTIONS: Array<{ key: SkySection; label: string; icon: typeof BookOpenCheck }> = [
  { key: 'learning', label: '学习工作台', icon: BookOpenCheck },
  { key: 'resources', label: '学习资源', icon: LibraryBig },
  { key: 'teaching', label: '备课工作区', icon: Presentation },
];

function isSectionActive(pathname: string, section: SkySection): boolean {
  if (section === 'learning') {
    return (
      pathname === '/sky' ||
      pathname.startsWith('/sky/learning') ||
      pathname.startsWith('/sky/study-lab') ||
      pathname.startsWith('/sky/student')
    );
  }

  if (section === 'resources') {
    return (
      (pathname.startsWith('/sky/cloud-mind') &&
        !pathname.startsWith('/sky/cloud-mind/teaching')) ||
      pathname.startsWith('/sky/assistant') ||
      pathname.startsWith('/sky/solve') ||
      pathname.startsWith('/sky/slides')
    );
  }

  return pathname.startsWith('/sky/teaching') || pathname.startsWith('/sky/cloud-mind/teaching');
}

function isItemActive(pathname: string, item: { href: string; exact?: boolean }): boolean {
  if (item.href.includes('#') || item.href.includes('?')) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface SkySidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

const INITIAL_EXPANDED_SECTIONS: Record<SkySection, boolean> = {
  learning: true,
  resources: true,
  teaching: true,
};

const SIDEBAR_SCROLL_STORAGE_KEY = 'sky-sidebar-scroll-top';

export function SkySidebar({ collapsed, onToggle }: SkySidebarProps) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const [expandedSections, setExpandedSections] = useState(INITIAL_EXPANDED_SECTIONS);

  const persistScrollPosition = () => {
    const scrollTop = navigationRef.current?.scrollTop;
    if (scrollTop !== undefined) {
      sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(scrollTop));
    }
  };

  useEffect(() => {
    const savedScrollTop = Number(sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY));
    if (Number.isFinite(savedScrollTop) && savedScrollTop > 0) {
      navigationRef.current?.scrollTo({ top: savedScrollTop });
    }
  }, []);

  useEffect(() => {
    const activeSection = SECTIONS.find((section) => isSectionActive(pathname, section.key));
    if (!activeSection) return;

    setExpandedSections((current) =>
      current[activeSection.key] ? current : { ...current, [activeSection.key]: true },
    );
  }, [pathname]);

  const toggleSection = (section: SkySection) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  return (
    <aside
      data-sky-sidebar
      aria-label="天空课堂工作区导航"
      className={cn(
        'absolute inset-y-0 left-0 z-40 flex min-h-dvh flex-col border-r border-slate-200/70 bg-white/75 backdrop-blur-xl transition-[width] duration-200 dark:border-cyan-100/10 dark:bg-[#07111f]/85',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      <div className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200/70 px-4 dark:border-cyan-100/10">
        <Link
          href="/sky"
          aria-label="返回天空课堂首页"
          className={cn('flex min-w-0 items-center gap-2.5', collapsed && 'justify-center')}
        >
          <img src="/logo-icon.svg" alt="天空课堂" className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                天空课堂
              </span>
              <span className="block text-[9px] font-medium tracking-[0.16em] text-slate-400 dark:text-slate-500">
                SKY CLASSROOM
              </span>
            </span>
          )}
        </Link>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? '展开工作区导航' : '收起工作区导航'}
            title={collapsed ? '展开导航' : '收起导航'}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-sky-100',
              collapsed && 'absolute right-1 top-1 h-6 w-6',
            )}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav
        ref={navigationRef}
        onClick={persistScrollPosition}
        onScroll={persistScrollPosition}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3"
        aria-label="工作区分区"
      >
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-400 dark:text-slate-500">
            工作区
          </p>
        )}

        <div className="flex min-h-full flex-1 flex-col">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            const sectionActive = isSectionActive(pathname, section.key);
            const sectionExpanded = expandedSections[section.key];
            const sectionContentId = `sidebar-${section.key}-content`;

            return (
              <section
                key={section.key}
                aria-labelledby={`sidebar-${section.key}`}
                className="border-b border-slate-200/70 py-2 first:pt-0 last:border-b-0 dark:border-cyan-100/10"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) {
                      onToggle?.();
                      return;
                    }
                    toggleSection(section.key);
                  }}
                  id={`sidebar-${section.key}`}
                  aria-controls={sectionContentId}
                  aria-expanded={sectionExpanded}
                  title={collapsed ? section.label : undefined}
                  className={cn(
                    'group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60',
                    collapsed && 'justify-center px-0',
                    sectionActive
                      ? 'bg-sky-500/10 text-sky-700 dark:bg-sky-300/10 dark:text-sky-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                      sectionActive
                        ? 'bg-sky-500 text-white dark:bg-sky-300 dark:text-slate-950'
                        : 'bg-slate-100 text-slate-500 group-hover:text-sky-600 dark:bg-white/[0.06] dark:text-slate-400 dark:group-hover:text-sky-100',
                    )}
                  >
                    <SectionIcon className="h-4 w-4" />
                  </span>
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{section.label}</span>}
                  {!collapsed && (
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-slate-500',
                        sectionExpanded && 'rotate-90 text-sky-500 dark:text-sky-200',
                      )}
                    />
                  )}
                </button>

                {!collapsed && sectionExpanded && (
                  <div
                    id={sectionContentId}
                    className="ml-6 mt-1.5 space-y-3 border-l border-slate-200/80 pl-3 dark:border-cyan-100/10"
                  >
                    {SECTION_GROUPS[section.key].map((group) => (
                      <div key={group.label}>
                        <p className="px-2 pb-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          {group.label}
                        </p>
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = isItemActive(pathname, item);

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60',
                                  active
                                    ? 'bg-sky-500 text-white shadow-sm dark:bg-sky-300 dark:text-slate-950'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-sky-700 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-sky-100',
                                )}
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 space-y-1 border-t border-slate-200/70 p-3 dark:border-cyan-100/10">
        <Link
          href="/sky"
          title={collapsed ? '天空课堂' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white',
            collapsed && 'justify-center px-0',
          )}
        >
          <Home className="h-4 w-4 shrink-0" />
          {!collapsed && <span>天空课堂首页</span>}
        </Link>
        <Link
          href="/settings"
          title={collapsed ? '设置' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white',
            collapsed && 'justify-center px-0',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>设置</span>}
        </Link>
      </div>
    </aside>
  );
}
