'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Loader2,
  FileText,
  Search,
  Clapperboard,
  Image as ImageIcon,
  Volume2,
  Save,
} from 'lucide-react';

import { OutlinesEditor } from '@/components/generation/outlines-editor';
import { useClassroomJob } from '@/lib/hooks/use-classroom-job';
import { useSettingsStore } from '@/lib/store/settings';
import { removeActiveJobEntry } from '@/lib/classroom/classroom-session';

function GenerationProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const {
    phase,
    step,
    progress,
    message,
    outlines,
    outlinesMeta,
    scenesGenerated,
    totalScenes,
    result,
    error,
    cancelling,
    approving,
    stepLabel,
    handleApproveOutline,
    handleCancel,
    setOutlines,
  } = useClassroomJob(jobId);

  const alwaysReview = useSettingsStore((s) => s.reviewOutlineEnabled);
  const setAlwaysReview = useSettingsStore((s) => s.setReviewOutlineEnabled);

  const handleGoToClassroom = () => {
    if (result?.classroomId) {
      removeActiveJobEntry(jobId!);
      router.push(`/classroom/${result.classroomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="w-20" />
          <h1 className="text-xl font-bold">课堂生成</h1>
          <div className="w-20" />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Done state */}
        {phase === 'done' && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">课堂生成完成！</h2>
            <p className="text-muted-foreground mb-6">共 {result.scenesCount} 个场景</p>
            <button
              onClick={handleGoToClassroom}
              className="rounded-xl bg-sky-500 px-6 py-3 text-white font-medium hover:bg-sky-600 transition-colors"
            >
              进入课堂
            </button>
          </motion.div>
        )}

        {/* Outline review */}
        {phase === 'reviewing' && outlines && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-sky-500" />
                <h2 className="text-lg font-semibold">
                  大纲已生成（{outlinesMeta?.totalScenes ?? outlines.length} 个场景）
                </h2>
              </div>
              <OutlinesEditor
                outlines={outlines}
                onChange={setOutlines}
                onConfirm={handleApproveOutline}
                onBack={() => {
                  router.push('/');
                }}
                alwaysReview={alwaysReview}
                onAlwaysReviewChange={setAlwaysReview}
                isLoading={approving}
              />
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? '取消中...' : '取消生成，删除此大纲'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Progress display — two-column layout */}
        {(phase === 'loading' || phase === 'generating' || phase === 'generating_slides') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-[360px_1fr]"
          >
            {/* ── LEFT: Progress bar + steps ── */}
            <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                  <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <p className="font-bold text-sky-700 dark:text-sky-300">
                    {phase === 'generating_slides' ? '生成幻灯片' : '生成课堂'}
                  </p>
                  <p className="text-xs text-muted-foreground">{stepLabel}</p>
                </div>
                <div className="ml-auto text-2xl font-bold text-sky-600">{progress}%</div>
              </div>

              <div className="mb-6">
                <div className="h-2 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r from-sky-400 via-sky-300 to-sky-400 ${
                      phase === 'generating' || phase === 'generating_slides'
                        ? 'progress-bar-animated'
                        : 'to-sky-600'
                    }`}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'researching', icon: Search, label: '搜索资料' },
                  { key: 'generating_outlines', icon: FileText, label: '生成大纲' },
                  { key: 'generating_scenes', icon: Clapperboard, label: '生成场景' },
                  { key: 'generating_media', icon: ImageIcon, label: '生成媒体' },
                  { key: 'persisting', icon: Save, label: '保存课堂' },
                ].map(({ key, icon: Icon, label }) => {
                  const isActive = step === key;
                  const isDone =
                    (key === 'researching' &&
                      [
                        'generating_outlines',
                        'awaiting_review',
                        'generating_scenes',
                        'generating_media',
                        'generating_tts',
                        'persisting',
                        'completed',
                      ].includes(step)) ||
                    (key === 'generating_outlines' &&
                      [
                        'awaiting_review',
                        'generating_scenes',
                        'generating_media',
                        'generating_tts',
                        'persisting',
                        'completed',
                      ].includes(step)) ||
                    (key === 'generating_scenes' &&
                      ['generating_media', 'generating_tts', 'persisting', 'completed'].includes(
                        step,
                      )) ||
                    (key === 'generating_media' &&
                      ['generating_tts', 'persisting', 'completed'].includes(step)) ||
                    (key === 'persisting' && ['completed'].includes(step));

                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                        isActive
                          ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                          : isDone
                            ? 'text-muted-foreground/70'
                            : 'text-muted-foreground/30'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          isDone
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                            : isActive
                              ? 'bg-sky-200 dark:bg-sky-800 text-sky-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>{label}</span>
                      {isActive && (
                        <span className="ml-auto text-xs text-sky-500 font-mono tabular-nums">
                          {key === 'generating_scenes' && totalScenes > 0
                            ? `${scenesGenerated}/${totalScenes}`
                            : key === 'generating_outlines'
                              ? '...'
                              : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => router.push('/')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回首页
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? '取消中...' : '取消生成'}
                </button>
              </div>

              <p className="mt-2 text-center text-xs text-muted-foreground">
                后台继续生成，返回后可查看进度
              </p>
            </div>

            {/* ── RIGHT: Live content feed ── */}
            <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-6 min-h-[400px]">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                {phase === 'generating_slides' ? '生成内容' : '实时进度'}
              </h3>

              {/* Phase: researching */}
              {step === 'researching' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
                    <Search className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">正在搜索相关资料</p>
                      <p className="text-xs text-muted-foreground">
                        {message || '收集背景信息...'}
                      </p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin ml-auto text-amber-500" />
                  </div>
                </div>
              )}

              {/* Phase: generating_outlines */}
              {step === 'generating_outlines' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 px-4 py-3">
                    <FileText className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">正在规划课堂结构</p>
                      <p className="text-xs text-muted-foreground">
                        {message || '分析知识体系，构建场景大纲...'}
                      </p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin ml-auto text-purple-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 animate-pulse rounded bg-purple-100 dark:bg-purple-900/20 w-full" />
                    <div className="h-3 animate-pulse rounded bg-purple-100 dark:bg-purple-900/20 w-3/4" />
                    <div className="h-3 animate-pulse rounded bg-purple-100 dark:bg-purple-900/20 w-5/6" />
                    <div className="h-3 animate-pulse rounded bg-purple-100 dark:bg-purple-900/20 w-2/3" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    正在分析您的需求，构建场景大纲...
                  </p>
                </div>
              )}

              {/* Phase: generating_scenes — show outlines with progress */}
              {(step === 'generating_scenes' || (step === 'awaiting_review' && outlines)) &&
                outlines &&
                outlines.length > 0 && (
                  <div className="space-y-2">
                    {outlines.map((outline, i) => {
                      const isSceneDone = scenesGenerated > i;
                      const isCurrentScene = scenesGenerated === i;
                      return (
                        <div
                          key={outline.id || i}
                          className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                            isCurrentScene
                              ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800'
                              : isSceneDone
                                ? 'bg-green-50/50 dark:bg-green-900/5'
                                : 'bg-gray-50/50 dark:bg-gray-900/5'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                              isSceneDone
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                : isCurrentScene
                                  ? 'bg-sky-200 dark:bg-sky-800 text-sky-700'
                                  : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                            }`}
                          >
                            {isSceneDone ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : isCurrentScene ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className="text-xs">{i + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm truncate ${isCurrentScene ? 'font-medium text-sky-700 dark:text-sky-300' : isSceneDone ? 'text-foreground/70' : 'text-muted-foreground/40'}`}
                            >
                              {outline.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {outline.type === 'slide'
                                ? '幻灯片'
                                : outline.type === 'quiz'
                                  ? '测验'
                                  : outline.type === 'interactive'
                                    ? '互动'
                                    : 'PBL'}
                              {outline.keyPoints?.length
                                ? ` · ${outline.keyPoints.length} 个要点`
                                : ''}
                            </p>
                          </div>
                          {isCurrentScene && (
                            <span className="text-xs text-sky-500 font-medium flex-shrink-0">
                              生成中
                            </span>
                          )}
                          {isSceneDone && (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                    {scenesGenerated < outlines.length && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        {scenesGenerated}/{outlines.length} 个场景已完成
                      </p>
                    )}
                  </div>
                )}

              {/* Phase: generating_scenes but no outlines yet */}
              {step === 'generating_scenes' && (!outlines || outlines.length === 0) && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">正在生成场景内容...</span>
                </div>
              )}

              {/* Phase: generating_media */}
              {step === 'generating_media' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-pink-50 dark:bg-pink-900/10 px-4 py-3">
                    <ImageIcon className="h-4 w-4 text-pink-500" />
                    <div>
                      <p className="text-sm font-medium">正在生成媒体文件</p>
                      <p className="text-xs text-muted-foreground">
                        {message || '图片、视频生成中...'}
                      </p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin ml-auto text-pink-500" />
                  </div>
                  {outlines && outlines.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {outlines.map((outline, i) => (
                        <div
                          key={outline.id || i}
                          className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
                            i < scenesGenerated ? 'text-foreground/70' : 'text-muted-foreground/40'
                          }`}
                        >
                          <CheckCircle2
                            className={`h-3.5 w-3.5 flex-shrink-0 ${i < scenesGenerated ? 'text-green-500' : 'text-gray-300'}`}
                          />
                          <span className="truncate">{outline.title}</span>
                          {i < scenesGenerated && outline.mediaGenerations?.length ? (
                            <span className="text-xs text-pink-500 ml-auto flex-shrink-0">
                              {outline.mediaGenerations.length} 个媒体
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Phase: generating_tts */}
              {step === 'generating_tts' && (
                <div className="flex items-center gap-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 px-4 py-3">
                  <Volume2 className="h-4 w-4 text-indigo-500" />
                  <div>
                    <p className="text-sm font-medium">正在生成语音</p>
                    <p className="text-xs text-muted-foreground">
                      {message || 'TTS 音频生成中...'}
                    </p>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin ml-auto text-indigo-500" />
                </div>
              )}

              {/* Phase: persisting */}
              {step === 'persisting' && (
                <div className="flex items-center gap-3 rounded-lg bg-teal-50 dark:bg-teal-900/10 px-4 py-3">
                  <Save className="h-4 w-4 text-teal-500" />
                  <div>
                    <p className="text-sm font-medium">正在保存课堂</p>
                    <p className="text-xs text-muted-foreground">将数据持久化到服务器...</p>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin ml-auto text-teal-500" />
                </div>
              )}

              {/* Initial/fallback */}
              {![
                'researching',
                'generating_outlines',
                'generating_scenes',
                'generating_media',
                'generating_tts',
                'persisting',
              ].includes(step) && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mb-3" />
                  <span className="text-sm">{message || '准备中...'}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function GenerationProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        </div>
      }
    >
      <GenerationProgressContent />
    </Suspense>
  );
}
