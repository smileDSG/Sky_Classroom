'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
// motion removed — using CSS animations for SSR compatibility
// Preview now shows PPTX screenshot only — SlideViewer removed
import { AvatarSpeechPlayer } from './avatar-speech-player';
import { AvatarSelector } from './avatar-selector';
import { TemplatePackGallery } from './template-pack-gallery';
import { SlideThumbnail } from './slide-thumbnail';
import { SlidePreviewGallery } from './slide-preview-gallery';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import type { AvatarConfig } from '@/lib/slides/types';
import { SkyBackground } from '@/components/sky/home/sky-background';

const DIFFICULTIES = [
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

export default function SlidesPage() {
  const searchParams = useSearchParams();

  // Persistent state from Zustand store
  const setSlides = useSkyClassroomStore((s) => s.setSlides);
  const generationOptions = useSkyClassroomStore((s) => s.generationOptions);
  const setGenerationOptions = useSkyClassroomStore((s) => s.setGenerationOptions);
  const storeSelectedAvatarId = useSkyClassroomStore((s) => s.selectedAvatarId);
  const setSelectedAvatarId = useSkyClassroomStore((s) => s.setSelectedAvatar);

  // Defensive: localStorage may contain stale non-string values from old schema
  const topic = typeof generationOptions?.topic === 'string' ? generationOptions.topic : '';
  const difficulty = ['junior', 'senior', 'college'].includes(generationOptions?.difficulty as string)
    ? generationOptions.difficulty
    : 'senior';

  // Ephemeral UI state
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig>(
    AVATAR_CONFIGS.find((a) => a.id === storeSelectedAvatarId) || AVATAR_CONFIGS[0],
  );
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTemplatePackGallery, setShowTemplatePackGallery] = useState(false);
  const [selectedTemplatePack, setSelectedTemplatePack] = useState<string>('');
  const [recommendedTemplate, setRecommendedTemplate] = useState<string>('');
  const [generatedPptx, setGeneratedPptx] = useState<{ url: string; fileName: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewId, setPreviewId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [genStage, setGenStage] = useState<'idle' | 'thinking' | 'writing' | 'rendering' | 'done'>('idle');
  const [genProgress, setGenProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback((stage: 'thinking' | 'writing' | 'rendering') => {
    setGenStage(stage);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let target = 0;
    let current = 0;
    let step = 0;
    let intervalMs = 500;
    if (stage === 'thinking') { current = 0; target = 8; step = (8 - 0) / 10; intervalMs = 300; }
    if (stage === 'writing') { current = 10; target = 90; step = (90 - 10) / 80; intervalMs = 600; }
    if (stage === 'rendering') { current = 92; target = 98; step = (98 - 92) / 12; intervalMs = 400; }
    setGenProgress(current);

    progressIntervalRef.current = setInterval(() => {
      setGenProgress((p) => {
        if (p >= target) {
          // 到达 target 后继续以极慢速度前进，避免"卡住"感
          if (stage === 'writing' && p < 95) {
            return Math.min(p + 0.3, 95);
          }
          if (stage === 'rendering' && p < 99) {
            return Math.min(p + 0.2, 99);
          }
          return p;
        }
        return Math.min(p + step, target);
      });
    }, intervalMs);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const handleGenerateWithTemplate = useCallback(async (templateId: string, overrideTopic?: string) => {
    const t = (overrideTopic ?? topic).trim();
    if (!t || !templateId) return;
    setGenerating(true);
    setStatus('AI 正在生成课件内容...');
    startProgress('writing');
    if (overrideTopic) {
      setGenerationOptions({ topic: overrideTopic, difficulty });
    }
    try {
      const res = await fetch('/api/sky/slides/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: t,
          difficulty,
          templateId,
        }),
      });
      const data = await res.json();
      if (data.success && data.pptxUrl) {
        setStatus('课件生成成功！');
        setGeneratedPptx({ url: data.pptxUrl, fileName: data.fileName || '课件.pptx' });
        // 清除旧的 v2/legacy slides，避免污染 previewImages 的页数统计
        setSlides([]);

        // 后端已直接返回预览图（合并generate+preview）
        if (data.slideImages?.length) {
          setGenStage('done');
          setGenProgress(100);
          stopProgress();
          setPreviewImages(data.slideImages);
          setPreviewId(data.previewId || '');
          setStatus('');
        } else {
          // Fallback: 后端未返回预览图时，前端自行调用preview API
          startProgress('rendering');
          try {
            setPreviewing(true);
            setStatus('正在生成课件预览...');
            const previewRes = await fetch('/api/sky/slides/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pptxUrl: data.pptxUrl }),
            });
            const previewData = await previewRes.json();
            if (previewData.success && previewData.slideImages?.length) {
              setGenStage('done');
              setGenProgress(100);
              setPreviewImages(previewData.slideImages);
              setPreviewId(previewData.previewId);
              setStatus('');
            } else {
              setStatus(`预览失败: ${previewData.error || '请重试'}`);
              setTimeout(() => setStatus(''), 3000);
            }
          } catch {
            setStatus('预览生成失败');
            setTimeout(() => setStatus(''), 3000);
          } finally {
            setPreviewing(false);
            stopProgress();
          }
        }
      } else {
        setStatus(`生成失败: ${data.error || '请重试'}`);
      }
    } catch {
      setStatus('网络错误，请检查服务是否运行');
    } finally {
      setGenerating(false);
      stopProgress();
    }
  }, [topic, difficulty, startProgress, stopProgress]);

  const handleGenerate = useCallback(async (overrideTopic?: string) => {
    const t = (overrideTopic ?? topic).trim();
    if (!t) return;
    // 先调用AI推断API获取推荐模板
    startProgress('thinking');
    try {
      setStatus('正在分析主题风格...');
      const res = await fetch('/api/sky/slides/infer-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (data.success && data.templateId) {
        setRecommendedTemplate(data.templateId);
      } else {
        setRecommendedTemplate('');
      }
    } catch {
      setRecommendedTemplate('');
    } finally {
      setStatus('');
      stopProgress();
      setShowTemplatePackGallery(true);
    }
  }, [topic, startProgress, stopProgress]);

  const handleDownloadGenerated = useCallback(() => {
    if (!generatedPptx) return;
    const a = document.createElement('a');
    a.href = generatedPptx.url;
    a.download = generatedPptx.fileName;
    a.click();
  }, [generatedPptx]);

  const onTemplatePackSelected = useCallback((templateId: string) => {
    setSelectedTemplatePack(templateId);
    handleGenerateWithTemplate(templateId);
  }, [handleGenerateWithTemplate]);

  // Auto-trigger generation from URL ?topic=xxx
  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    if (urlTopic && !autoTriggered && !generating) {
      setAutoTriggered(true);
      handleGenerate(urlTopic);
    }
  }, [searchParams, autoTriggered, generating, handleGenerate]);

  const totalPages = previewImages?.length ?? 0;
  const hasContent = !!previewImages?.length || !!generatedPptx;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => Math.min(totalPages - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalPages]);



  return (
    <div className="flex h-screen w-full flex-col overflow-hidden relative">
      <SkyBackground />

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <style jsx global>{`
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-left {
          animation: fadeInLeft 0.5s ease-out forwards;
        }
        .animate-fade-in-right {
          animation: fadeInRight 0.5s ease-out 0.2s forwards;
          opacity: 0;
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.5s ease-out 0.1s forwards;
          opacity: 0;
        }
        .animate-fade-in-scale {
          animation: fadeInScale 0.5s ease-out forwards;
        }
      `}</style>

      {/* Top bar */}
      <header className="relative z-10 flex flex-shrink-0 items-center border-b border-slate-200/50 bg-white/70 px-6 py-3 backdrop-blur-xl">
        {/* Left: brand */}
        <div className="flex w-48 flex-shrink-0 items-center gap-3 animate-fade-in-left">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/25">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent tracking-tight">天空课堂</span>
            <span className="text-[10px] font-medium text-slate-400 -mt-0.5">AI 互动课件</span>
          </div>
          {hasContent && (
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
        <div className="flex flex-1 items-center justify-center gap-3 animate-fade-in-down">
          <div className="relative w-full max-w-md">
            <input
              value={topic}
              onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="输入教学主题，如：勾股定理、牛顿定律…"
              className="w-full rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm px-4 py-2.5 pl-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all shadow-sm"
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

          <div className="inline-flex flex-shrink-0 rounded-xl border border-slate-200/80 bg-white/60 p-0.5 shadow-sm backdrop-blur-sm">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setGenerationOptions({ topic, difficulty: d.value })}
                className={`relative rounded-[10px] px-3.5 py-2 text-sm font-semibold transition-all duration-300 ${
                  d.value === difficulty
                    ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md shadow-sky-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={generating || !topic.trim()}
            className="relative inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-sky-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
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

        {/* Right: status + template */}
        <div className="flex w-48 flex-shrink-0 items-center justify-end gap-2 animate-fade-in-right">
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
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside
          className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/50 bg-white/60 backdrop-blur-xl transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-0 border-r-0'
          }`}
        >
          {/* Avatar selector */}
          <div className="scrollbar-hide flex-shrink-0 overflow-y-auto px-4 pt-4" style={{ maxHeight: '35%', overscrollBehavior: 'contain' }}>
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

          {/* Thumbnails */}
          <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" style={{ overscrollBehavior: 'contain' }}>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                幻灯片
              </span>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold tabular-nums text-slate-500">
                {totalPages}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {previewImages ? (
                previewImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`group relative flex items-center gap-3 rounded-xl p-2 text-left transition-all duration-300 ${
                      i === activeIndex
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 ring-1 ring-blue-200/60 shadow-sm shadow-blue-100/50'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={img}
                        alt={`Thumb ${i + 1}`}
                        className="h-[45px] w-[80px] rounded-lg object-cover shadow-sm"
                        draggable={false}
                      />
                      <span className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shadow-sm ${
                        i === activeIndex
                          ? 'bg-sky-500 text-white shadow-sky-200'
                          : 'bg-white text-slate-400 shadow-sm ring-1 ring-slate-200'
                      }`}>
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span
                        className={`text-[11px] font-semibold ${
                          i === activeIndex ? 'text-sky-700' : 'text-slate-500'
                        }`}
                      >
                        {i === 0 ? '封面' : i === previewImages.length - 1 ? '封底' : `第 ${i + 1} 页`}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {i === activeIndex ? (
                          <span className="flex items-center gap-1 text-sky-500">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                            </span>
                            当前
                          </span>
                        ) : (
                          ''
                        )}
                      </span>
                    </div>
                  </button>
                ))
              ) : null}
            </div>
          </div>
        </aside>

        {/* Right: slide display */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1">
            {previewImages ? (
              <div className="flex h-full items-center justify-center bg-white/40 backdrop-blur-sm p-6">
                <img
                  src={previewImages[activeIndex]}
                  alt={`Slide ${activeIndex + 1}`}
                  className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
                  style={{ aspectRatio: '16/9' }}
                  draggable={false}
                />
              </div>
            ) : generating ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 backdrop-blur-sm gap-5">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
                <div className="flex flex-col items-center gap-3 w-64">
                  <p className="text-sm font-medium text-slate-600">
                    {genStage === 'thinking' && '正在分析主题风格...'}
                    {genStage === 'writing' && 'AI 正在撰写课件内容...'}
                    {genStage === 'rendering' && '正在渲染课件预览...'}
                    {genStage === 'done' && '课件生成成功'}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${genProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 tabular-nums">{Math.round(genProgress)}%</p>
                </div>
              </div>
            ) : generatedPptx ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 backdrop-blur-sm gap-4 animate-fade-in-scale">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 shadow-sm">
                  <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-700">课件生成成功</p>
                  <p className="text-xs text-slate-400">文件已自动下载到本地</p>
                </div>
                <button
                  onClick={handleDownloadGenerated}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  重新下载课件
                </button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 backdrop-blur-sm gap-3 animate-fade-in-scale">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/60 shadow-sm">
                  <svg className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">输入主题，点击生成课件</p>
              </div>
            )}
            <AvatarSpeechPlayer
              avatar={hasContent ? selectedAvatar : null}
              speech={null}
              activeSlideIndex={activeIndex}
              totalSlides={totalPages}
            />
          </div>

          {generatedPptx && (
            <footer className="flex flex-shrink-0 items-center justify-between border-t border-slate-200/50 bg-white/60 px-6 py-2.5 backdrop-blur-xl">
              {previewImages && previewImages.length > 0 ? (
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
                      <span className="font-medium">{totalPages}</span>
                    </span>
                    {/* Progress bar */}
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500"
                        style={{ width: `${((activeIndex + 1) / totalPages) * 100}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveIndex((i) => Math.min(totalPages - 1, i + 1))}
                    disabled={activeIndex === totalPages - 1}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                  >
                    下一页
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>课件已生成</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setGeneratedPptx(null);
                    handleGenerate();
                  }}
                  disabled={generating}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  重新生成
                </button>
                {generatedPptx && (
                  <button
                    onClick={handleDownloadGenerated}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载课件
                  </button>
                )}
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

      <TemplatePackGallery
        open={showTemplatePackGallery}
        topic={topic}
        recommendedId={recommendedTemplate}
        onSelect={onTemplatePackSelected}
        onClose={() => setShowTemplatePackGallery(false)}
      />
    </div>
  );
}
