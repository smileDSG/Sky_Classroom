'use client';

import { useState, useCallback, useEffect } from 'react';
// Preview now shows PPTX screenshot only — SlideViewer removed
import { AvatarSpeechPlayer } from './avatar-speech-player';
import { AvatarSelector } from './avatar-selector';
import { ThemePreviewCard } from './theme-preview-card';
import { SlideThumbnail } from './slide-thumbnail';
import { SlidePreviewGallery } from './slide-preview-gallery';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import type { AvatarConfig } from '@/lib/slides/types';
import type { PptxThemeId } from '@/lib/slides/types';
import { getAllThemeIds } from '@/lib/slides/pptx-themes';

const DIFFICULTIES = [
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

const THEME_IDS = getAllThemeIds() as PptxThemeId[];

export default function SlidesPage() {
  // Persistent state from Zustand store
  const slides = useSkyClassroomStore((s) => s.slides);
  const setSlides = useSkyClassroomStore((s) => s.setSlides);
  const generationOptions = useSkyClassroomStore((s) => s.generationOptions);
  const setGenerationOptions = useSkyClassroomStore((s) => s.setGenerationOptions);
  const storeSelectedAvatarId = useSkyClassroomStore((s) => s.selectedAvatarId);
  const setSelectedAvatarId = useSkyClassroomStore((s) => s.setSelectedAvatar);

  const topic = generationOptions.topic ?? '';
  const difficulty = generationOptions.difficulty ?? 'senior';

  // Ephemeral UI state
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig>(
    AVATAR_CONFIGS.find((a) => a.id === storeSelectedAvatarId) || AVATAR_CONFIGS[0],
  );
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exportTheme, setExportTheme] = useState<PptxThemeId>('sky-blue');
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'template-bg' | 'ai' | 'template'>('template-bg');
  const [previewing, setPreviewing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewId, setPreviewId] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setStatus('AI 正在生成幻灯片...');
    setGenerationOptions({ topic, difficulty });
    try {
      const res = await fetch('/api/sky/slides/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          difficulty,
          slideCount: undefined,
          language: 'Use Simplified Chinese for all content',
          avatarId: selectedAvatar.id,
          themeId: exportTheme,
          useTemplates: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.slides?.length) {
        setSlides(data.slides);
        setActiveIndex(0);
        setStatus('');
        // 自动生成 PPTX 截图预览
        setTimeout(() => handlePreview(), 0);
      } else {
        setStatus(`生成失败: ${data.error || '请重试'}`);
      }
    } catch {
      setStatus('网络错误，请检查服务是否运行');
    } finally {
      setGenerating(false);
    }
  }, [topic, difficulty, selectedAvatar.id, exportTheme]);

  const handlePreview = useCallback(async () => {
    if (!slides.length) return;
    setPreviewing(true);
    setStatus('正在生成预览...');
    try {
      const res = await fetch('/api/sky/slides/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topic || '课件',
          slides,
          theme: exportTheme,
          previewId: previewId || undefined,
          layoutMode,
        }),
      });
      const data = await res.json();
      if (data.success && data.slideImages?.length) {
        setPreviewImages(data.slideImages);
        setPreviewId(data.previewId);
        setShowPreview(true);
        setStatus('');
      } else {
        setStatus(`预览失败: ${data.error || '请重试'}`);
        setTimeout(() => setStatus(''), 3000);
      }
    } catch {
      setStatus('预览失败');
      setTimeout(() => setStatus(''), 3000);
    } finally {
      setPreviewing(false);
    }
  }, [slides, topic, exportTheme, previewId, layoutMode]);

  const handleExport = useCallback(async () => {
    if (!slides.length) return;
    setExporting(true);
    try {
      const res = await fetch('/api/sky/slides/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: topic || '课件', slides, theme: exportTheme, layoutMode }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topic || '课件'}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('导出成功');
      setTimeout(() => setStatus(''), 3000);
    } catch {
      setStatus('导出失败');
    } finally {
      setExporting(false);
    }
  }, [slides, topic, exportTheme, layoutMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => Math.min(slides.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  const currentSlide = slides[activeIndex] || null;

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#f8fafc]">
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center border-b border-slate-200/60 bg-white/80 px-6 py-3 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Left: brand */}
        <div className="flex w-48 flex-shrink-0 items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200/50 ring-1 ring-white/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800 tracking-tight">天空课堂</span>
            <span className="text-[10px] font-medium text-slate-400 -mt-0.5">AI 互动课件</span>
          </div>
          {slides.length > 0 && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 hover:scale-105 active:scale-95"
              title={sidebarOpen ? '收起讲解栏' : '展开讲解栏'}
            >
              <svg
                className={`h-4 w-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Center: input + controls */}
        <div className="flex flex-1 items-center justify-center gap-3">
          <div className="relative w-full max-w-md">
            <input
              value={topic}
              onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="输入教学主题，如：勾股定理、牛顿定律…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="inline-flex flex-shrink-0 rounded-xl border border-slate-200/80 bg-slate-50/80 p-0.5 shadow-sm backdrop-blur-sm">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setGenerationOptions({ topic, difficulty: d.value })}
                className={`relative rounded-[10px] px-3.5 py-2 text-sm font-semibold transition-all duration-300 ${
                  d.value === difficulty
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="relative inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-200/50 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
          >
            {generating && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className="relative">
              {generating ? '生成中' : '生成幻灯片'}
              {!generating && (
                <span className="absolute -right-1 -top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Right: status */}
        <div className="flex w-48 flex-shrink-0 items-center justify-end">
          {status && (
            <span
              className={`text-xs font-medium ${
                status.includes('失败') || status.includes('错误')
                  ? 'text-red-500'
                  : 'text-slate-500'
              }`}
            >
              {status}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside
          className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/60 bg-white/70 backdrop-blur-xl transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-0 border-r-0'
          }`}
        >
          {/* Avatar selector */}
          <div className="scrollbar-hide flex-shrink-0 overflow-y-auto px-4 pt-4" style={{ maxHeight: '35%' }}>
            <AvatarSelector
              avatars={AVATAR_CONFIGS}
              selectedId={selectedAvatar.id}
              onSelect={(id) => {
                const a = AVATAR_CONFIGS.find((av) => av.id === id) || AVATAR_CONFIGS[0];
                setSelectedAvatar(a);
                setSelectedAvatarId(a.id);
              }}
            />
          </div>

          <div className="mx-4 h-px flex-shrink-0 bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

          {/* Theme selector toggle */}
          <div className="flex-shrink-0 px-4 py-3">
            <button
              onClick={() => setShowThemePanel((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-100/80 hover:text-slate-600"
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                导出主题
              </span>
              <svg
                className={`h-3 w-3 transition-transform duration-300 ${showThemePanel ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showThemePanel && (
              <div className="scrollbar-hide mt-2 grid max-h-60 grid-cols-2 gap-2 overflow-y-auto">
                {THEME_IDS.map((tid) => (
                  <ThemePreviewCard
                    key={tid}
                    themeId={tid}
                    selected={tid === exportTheme}
                    onSelect={setExportTheme}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mx-4 h-px flex-shrink-0 bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

          {/* Layout mode selector */}
          <div className="flex-shrink-0 px-4 py-3">
            <span className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              布局模式
            </span>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setLayoutMode('template-bg')}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                  layoutMode === 'template-bg'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                WPS 模板背景 + AI 排版
              </button>
              <button
                onClick={() => setLayoutMode('ai')}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                  layoutMode === 'ai'
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                AI 自由排版
              </button>
              <button
                onClick={() => setLayoutMode('template')}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                  layoutMode === 'template'
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                WPS 模板填充
              </button>
            </div>
          </div>

          <div className="mx-4 h-px flex-shrink-0 bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

          {/* Thumbnails */}
          <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                幻灯片
              </span>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold tabular-nums text-slate-500">
                {slides.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveIndex(i)}
                  className={`group relative flex items-center gap-3 rounded-xl p-2 text-left transition-all duration-300 ${
                    i === activeIndex
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 ring-1 ring-blue-200/60 shadow-sm shadow-blue-100/50'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {previewImages ? (
                      <img
                        src={previewImages[i]}
                        alt={`Thumb ${i + 1}`}
                        className="h-[45px] w-[80px] rounded-lg object-cover shadow-sm"
                        draggable={false}
                      />
                    ) : (
                      <SlideThumbnail slide={slide} theme={exportTheme} width={80} />
                    )}
                    <span className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shadow-sm ${
                      i === activeIndex
                        ? 'bg-blue-500 text-white shadow-blue-200'
                        : 'bg-white text-slate-400 shadow-sm ring-1 ring-slate-200'
                    }`}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`text-[11px] font-semibold ${
                        i === activeIndex ? 'text-blue-700' : 'text-slate-500'
                      }`}
                    >
                      {slide.type === 'cover' ? '封面' : slide.type === 'end' ? '封底' : `第 ${i + 1} 页`}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {i === activeIndex ? (
                        <span className="flex items-center gap-1 text-blue-500">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                          </span>
                          当前
                        </span>
                      ) : (
                        ''
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: slide display */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1">
            {previewImages ? (
              <div className="flex h-full items-center justify-center bg-slate-100 p-6">
                <img
                  src={previewImages[activeIndex]}
                  alt={`Slide ${activeIndex + 1}`}
                  className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
                  style={{ aspectRatio: '16/9' }}
                  draggable={false}
                />
              </div>
            ) : slides.length > 0 ? (
              <div className="flex h-full flex-col items-center justify-center bg-slate-100 gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
                <p className="text-sm text-slate-500">
                  {previewing ? '正在生成课件预览...' : '课件生成中，请稍候...'}
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-slate-100 gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200/50">
                  <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">输入主题，点击生成课件</p>
              </div>
            )}
            <AvatarSpeechPlayer
              avatar={slides.length > 0 ? selectedAvatar : null}
              speech={null}
              activeSlideIndex={activeIndex}
              totalSlides={slides.length}
            />
          </div>

          {slides.length > 0 && (
            <footer className="flex flex-shrink-0 items-center justify-between border-t border-slate-200/60 bg-white/70 px-6 py-2.5 backdrop-blur-xl shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                  disabled={activeIndex === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  上一页
                </button>

                <div className="flex flex-col items-center gap-1">
                  <span className="min-w-[4rem] text-center text-xs tabular-nums text-slate-400">
                    <span className="font-bold text-slate-700">{activeIndex + 1}</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="font-medium">{slides.length}</span>
                  </span>
                  {/* Progress bar */}
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-500"
                      style={{ width: `${((activeIndex + 1) / slides.length) * 100}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
                  disabled={activeIndex === slides.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                >
                  下一页
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  重新生成
                </button>
                <button
                  onClick={handlePreview}
                  disabled={previewing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {previewing ? '预览中' : '预览课件'}
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-200/40 transition-all hover:shadow-xl hover:shadow-emerald-200/50 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting ? '导出中' : '导出 PPTX'}
                </button>
              </div>
            </footer>
          )}
        </main>
      </div>

      {showPreview && previewImages && (
        <SlidePreviewGallery
          slideImages={previewImages}
          initialIndex={activeIndex}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
