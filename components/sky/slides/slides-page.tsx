'use client';

import { useState, useCallback, useEffect } from 'react';
import { SlideViewer } from './slide-viewer';
import { AvatarPlayer } from './avatar-player';
import { AvatarSelector } from './avatar-selector';
import { ThumbnailList } from './thumbnail-list';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import type { AvatarConfig } from '@/lib/slides/types';

const DIFFICULTIES = [
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

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

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setStatus('AI 正在生成幻灯片...');
    // Persist topic & difficulty so they survive navigation
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
        }),
      });
      const data = await res.json();
      if (data.success && data.slides?.length) {
        setSlides(data.slides);
        setActiveIndex(0);
        setStatus('');
      } else {
        setStatus(`生成失败: ${data.error || '请重试'}`);
      }
    } catch {
      setStatus('网络错误，请检查服务是否运行');
    } finally {
      setGenerating(false);
    }
  }, [topic, difficulty]);

  const handleExport = useCallback(async () => {
    if (!slides.length) return;
    setExporting(true);
    try {
      const result = await exportCourseToPPTX(
        { title: topic || '课件', includeSlides: true, includeSpeakerNotes: false, includeKnowledgePoints: false, includeSimilarQuestions: false },
        slides,
      );
      const a = document.createElement('a');
      a.href = result.fileUrl;
      a.download = result.fileName;
      a.click();
      setStatus(`已导出: ${result.fileName}`);
      setTimeout(() => setStatus(''), 3000);
    } catch {
      setStatus('导出失败');
    } finally {
      setExporting(false);
    }
  }, [slides, topic]);

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
    /* Fill all available space from SkyAppShell */
    <div className="-m-6 flex flex-col bg-[#F8FAFC]" style={{ minHeight: 'calc(100vh - 3.5rem)', height: 'calc(100vh - 3.5rem)' }}>
      {/* Hide scrollbars globally on this page */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="flex flex-1 flex-col bg-[#F8FAFC]">
        {/* Top bar — three-column layout */}
        <header className="flex flex-shrink-0 items-center border-b border-slate-200/80 bg-white/80 px-6 py-3 backdrop-blur">
          {/* Left: title + sidebar toggle */}
          <div className="flex w-48 flex-shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm shadow-blue-200">
              S
            </div>
            <span className="text-sm font-semibold text-slate-600">幻灯片讲解</span>
            {slides.length > 0 && (
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title={sidebarOpen ? '收起讲解栏' : '展开讲解栏'}
              >
                <svg className="h-4 w-4 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Center: input + difficulty + action */}
          <div className="flex flex-1 items-center justify-center gap-3">
            <div className="relative w-full max-w-md">
              <input
                value={topic}
                onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="输入教学主题，如：勾股定理、牛顿定律…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pl-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="inline-flex flex-shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setGenerationOptions({ topic, difficulty: d.value })}
                  className={`rounded-[10px] px-3.5 py-2 text-sm font-semibold transition-all ${
                    d.value === difficulty
                      ? 'bg-white text-[#2563eb] shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="relative inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {generating && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {generating ? '生成中' : '生成幻灯片'}
            </button>
          </div>

          {/* Right: status */}
          <div className="flex w-48 flex-shrink-0 items-center justify-end">
            {status && (
              <span className={`text-xs font-medium ${
                status.includes('失败') || status.includes('错误') ? 'text-red-500' : 'text-slate-500'
              }`}>
                {generating ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
                    </span>
                    {status}
                  </span>
                ) : status}
              </span>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — collapsible 讲解栏 */}
          <aside
            className={`scrollbar-hide flex-shrink-0 overflow-hidden border-r border-slate-200/80 bg-white/60 backdrop-blur transition-all duration-300 ${
              sidebarOpen ? 'w-60' : 'w-0 border-r-0'
            }`}
          >
            <div className="flex w-60 flex-col gap-5 overflow-y-auto p-4" style={{ height: '100%' }}>
              <AvatarSelector
                avatars={AVATAR_CONFIGS}
                selectedId={selectedAvatar.id}
                onSelect={(id) => { const a = AVATAR_CONFIGS.find((av) => av.id === id) || AVATAR_CONFIGS[0]; setSelectedAvatar(a); setSelectedAvatarId(a.id); }}
              />
              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              <ThumbnailList slides={slides} activeIndex={activeIndex} onSelect={setActiveIndex} />
            </div>
          </aside>

          {/* Right: slide display */}
          <main className="relative flex flex-1 flex-col overflow-hidden">
            <div className="relative flex-1">
              <SlideViewer slide={currentSlide} />
              <AvatarPlayer avatar={slides.length > 0 ? selectedAvatar : null} speech={null} />
            </div>

            {/* Bottom bar */}
            {slides.length > 0 && (
              <footer className="flex flex-shrink-0 items-center justify-between border-t border-slate-200/80 bg-white/80 px-6 py-2.5 backdrop-blur">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    上一页
                  </button>
                  <span className="min-w-[4rem] text-center text-xs tabular-nums text-slate-400">
                    <span className="font-semibold text-slate-600">{activeIndex + 1}</span>
                    <span className="mx-1">/</span>
                    {slides.length}
                  </span>
                  <button
                    onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
                    disabled={activeIndex === slides.length - 1}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    下一页
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    重新生成
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {exporting ? '导出中' : '导出 PPTX'}
                  </button>
                </div>
              </footer>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
