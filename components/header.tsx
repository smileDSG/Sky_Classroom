'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  Download,
  FileDown,
  Layers3,
  Loader2,
  Monitor,
  Moon,
  Package,
  Settings,
  Sun,
} from 'lucide-react';
import { SettingsDialog } from './settings';
import { useTheme } from '@/lib/hooks/use-theme';
import { useExportClassroom } from '@/lib/export/use-export-classroom';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useStageStore } from '@/lib/store/stage';
import { cn } from '@/lib/utils';

interface HeaderProps {
  readonly currentSceneTitle: string;
  readonly timelineCollapsed: boolean;
  readonly onTimelineCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
  readonly isCourseComplete?: boolean;
}

export function Header({
  currentSceneTitle,
  timelineCollapsed: _timelineCollapsed,
  onTimelineCollapseChange: _onTimelineCollapseChange,
}: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const { exporting: isExportingZip, exportClassroomZip } = useExportClassroom();
  const scenes = useStageStore((state) => state.scenes);
  const currentSceneId = useStageStore((state) => state.currentSceneId);
  const generatingOutlines = useStageStore((state) => state.generatingOutlines);
  const failedOutlines = useStageStore((state) => state.failedOutlines);
  const mediaTasks = useMediaGenerationStore((state) => state.tasks);

  const currentSceneIndex = scenes.findIndex((scene) => scene.id === currentSceneId);
  const progressLabel =
    currentSceneIndex >= 0 ? `${currentSceneIndex + 1}/${Math.max(scenes.length, 1)}` : '--';
  const canExport =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    Object.values(mediaTasks).every((task) => task.status === 'done' || task.status === 'failed');

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (themeOpen && themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
      if (
        exportMenuOpen &&
        exportRef.current &&
        !exportRef.current.contains(event.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    },
    [exportMenuOpen, themeOpen],
  );

  useEffect(() => {
    if (!themeOpen && !exportMenuOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen, handleClickOutside, themeOpen]);

  const themeIcon = (() => {
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  })();

  return (
    <>
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-sky-100/80 bg-white/76 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/92">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sky-800/70 transition-colors hover:bg-white/85 hover:text-sky-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
              {currentSceneTitle || 'Loading slide'}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-sky-800/60 dark:text-slate-400">
              <span>Slide {progressLabel}</span>
              {generatingOutlines.length > 0 && <span>Building {generatingOutlines.length}</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800/75 dark:bg-slate-900 dark:text-slate-400 sm:flex">
            <Layers3 className="h-3.5 w-3.5" />
            {scenes.length}
          </div>

          <div className="relative" ref={themeRef}>
            <button
              type="button"
              onClick={() => setThemeOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sky-800/70 transition-colors hover:bg-white/85 hover:text-sky-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title="Theme"
              aria-label="Theme"
            >
              {themeIcon}
            </button>
            {themeOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'system', label: 'System', icon: Monitor },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTheme(item.id as 'light' | 'dark' | 'system');
                        setThemeOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
                        theme === item.id
                          ? 'text-slate-950 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sky-800/70 transition-colors hover:bg-white/85 hover:text-sky-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => {
                if (canExport && !isExporting && !isExportingZip) {
                  setExportMenuOpen((open) => !open);
                }
              }}
              disabled={!canExport || isExporting || isExportingZip}
              className={cn(
                'flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors',
                canExport && !isExporting && !isExportingZip
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20 hover:bg-sky-500 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
              )}
              title={canExport ? 'Export' : 'Available after generation'}
            >
              {isExporting || isExportingZip ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Export</span>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportPPTX();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FileDown className="h-4 w-4 text-slate-400" />
                  PPTX
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportResourcePack();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Package className="h-4 w-4 text-slate-400" />
                  Resource pack
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportClassroomZip();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Archive className="h-4 w-4 text-slate-400" />
                  Classroom ZIP
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
