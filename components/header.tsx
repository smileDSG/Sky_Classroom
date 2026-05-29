'use client';

import {
  Settings,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  Loader2,
  Download,
  FileDown,
  Package,
  Archive,
  PanelLeftClose,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
} from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsDialog } from './settings';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store/stage';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { useExportClassroom } from '@/lib/export/use-export-classroom';
import { SceneTimeline } from '@/components/stage/scene-timeline';

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
  timelineCollapsed,
  onTimelineCollapseChange,
  onSceneSelect,
  onRetryOutline,
  isCourseComplete,
}: HeaderProps) {const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(100);
  const [isResizing, setIsResizing] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Export
  const { exporting: isExporting, exportPPTX, exportResourcePack } = useExportPPTX();
  const { exporting: isExportingZip, exportClassroomZip } = useExportClassroom();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const scenes = useStageStore((s) => s.scenes);
  const generatingOutlines = useStageStore((s) => s.generatingOutlines);
  const failedOutlines = useStageStore((s) => s.failedOutlines);
  const mediaTasks = useMediaGenerationStore((s) => s.tasks);

  const canExport =
    scenes.length > 0 &&
    generatingOutlines.length === 0 &&
    failedOutlines.length === 0 &&
    Object.values(mediaTasks).every((task) => task.status === 'done' || task.status === 'failed');

  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (themeOpen && themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
      if (exportMenuOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    },
    [themeOpen, exportMenuOpen],
  );

  useEffect(() => {
    if (themeOpen || exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [themeOpen, exportMenuOpen, handleClickOutside]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = headerHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [headerHeight]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const delta = e.clientY - resizeStartY.current;
    const newHeight = Math.max(48, Math.min(200, resizeStartHeight.current + delta));
    setHeaderHeight(newHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const isCompact = headerHeight < 70;

  return (
    <>
      <header
        ref={headerRef}
        style={{ height: headerHeight }}
        className="relative px-6 py-2 flex flex-col gap-2 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shrink-0 sticky top-0 transition-colors duration-200"
      >
        {/* Main header content */}
        <div className="flex items-center gap-4 flex-1 min-h-0">
          {/* Left: Back + Title - fixed width */}
          <div className="flex items-center gap-3 shrink-0" style={{ width: 180 }}>
            <button
              onClick={() => router.push('/')}
              className="shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title={'返回首页'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-0.5">
                {'当前场景'}
              </span>
              <h1
                className="text-sm font-bold text-gray-800 dark:text-gray-200 tracking-tight truncate"
                suppressHydrationWarning
              >
                {currentSceneTitle || '加载中...'}
              </h1>
            </div>
          </div>

          {/* Center: Timeline - fills available space */}
          <div
            className={cn(
              'flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 overflow-hidden transition-all duration-200',
              isCompact ? 'h-[28px]' : 'h-full'
            )}
          >
            <SceneTimeline
              collapsed={isCompact}
              onCollapseChange={onTimelineCollapseChange}
              onSceneSelect={onSceneSelect}
              onRetryOutline={onRetryOutline}
              isCourseComplete={isCourseComplete}
            />
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md px-2 py-1.5 rounded-full border border-gray-100/50 dark:border-gray-700/50 shadow-sm shrink-0">
          {/* Theme Selector */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => {
                setThemeOpen(!themeOpen);
              }}
              className="p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm transition-all group"
            >
              {theme === 'light' && <Sun className="w-4 h-4" />}
              {theme === 'dark' && <Moon className="w-4 h-4" />}
              {theme === 'system' && <Monitor className="w-4 h-4" />}
            </button>
            {themeOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]">
                <button
                  onClick={() => {
                    setTheme('light');
                    setThemeOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
                    theme === 'light' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  <Sun className="w-4 h-4" />
                  {'浅色'}
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setThemeOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
                    theme === 'dark' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  <Moon className="w-4 h-4" />
                  {'深色'}
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setThemeOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
                    theme === 'system' &&
                      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                  )}
                >
                  <Monitor className="w-4 h-4" />
                  {'跟随系统'}
                </button>
              </div>
            )}
          </div>

          <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700" />

          {/* Settings Button */}
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm transition-all group"
            >
              <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
        </div>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => {
              if (canExport && !isExporting && !isExportingZip) setExportMenuOpen(!exportMenuOpen);
            }}
            disabled={!canExport || isExporting || isExportingZip}
            title={
              canExport
                ? isExporting || isExportingZip
                  ? '正在导出...'
                  : '导出 PPTX'
                : '生成完成后可分享'
            }
            className={cn(
              'shrink-0 p-2 rounded-full transition-all',
              canExport && !isExporting && !isExportingZip
                ? 'text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 hover:shadow-sm'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50',
            )}
          >
            {isExporting || isExportingZip ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
          {exportMenuOpen && (
            <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  exportPPTX();
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
              >
                <FileDown className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{'导出 PPTX'}</span>
              </button>
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  exportResourcePack();
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
              >
                <Package className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <div>{'导出教学资源包'}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">
                    {'PPTX + 交互式页面'}
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setExportMenuOpen(false);
                  exportClassroomZip();
                }}
                disabled={isExportingZip}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2.5"
              >
                <Archive className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <div>{'导出课堂 ZIP'}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">
                    {'课程结构 + 媒体文件'}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Main header content closing */}
        </div>

        {/* Resize handle at bottom */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            'absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center',
            'opacity-0 hover:opacity-100 transition-opacity',
            isResizing && 'opacity-100'
          )}
          style={{ transform: 'translateY(50%)' }}
        >
          <div className="w-16 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
            <GripHorizontal className="w-3 h-3 text-gray-500 dark:text-gray-400" />
          </div>
        </div>
      </header>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
