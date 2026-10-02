'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ImageIcon, FileText, X, Search, Atom, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpeechButton } from '@/components/audio/speech-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AgentSelector } from './agent-selector';

// 工具栏 chip 的统一样式：未选中中性灰，选中为唯一的品牌蓝。
function toolbarChipClass(active: boolean) {
  return cn(
    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200',
  );
}

// 主输入区域组件
export function HeroInput({
  value,
  onChange,
  onSubmit,
  onTemplateClick,
  pdfFile,
  onPdfChange,
  interactiveMode,
  onInteractiveModeChange,
  webSearch,
  onWebSearchChange,
  canSubmit,
  onSettingsOpen,
  selectedTeacherId,
  selectedStudentIds,
  onTeacherChange,
  onStudentsChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onTemplateClick: () => void;
  pdfFile: File | null;
  onPdfChange: (file: File | null) => void;
  interactiveMode: boolean;
  onInteractiveModeChange: (enabled: boolean) => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  canSubmit: boolean;
  onSettingsOpen: () => void;
  selectedTeacherId: string;
  selectedStudentIds: string[];
  onTeacherChange: (teacherId: string) => void;
  onStudentsChange: (studentIds: string[]) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // 空态示例轮播：让首访者秒懂"这里能打什么"。聚焦或已输入就停，把位置让给你。
  const EXAMPLES = [
    '从零学 Python，30 分钟写出第一个程序',
    '用白板给我讲傅里叶变换',
    '阿瓦隆桌游怎么玩',
  ];
  const [exIdx, setExIdx] = useState(0);
  useEffect(() => {
    if (isFocused || value.trim().length > 0) return;
    const t = setInterval(() => setExIdx((i) => (i + 1) % EXAMPLES.length), 3800);
    return () => clearInterval(t);
  }, [isFocused, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }
    },
    [canSubmit, onSubmit],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        onPdfChange(file);
      }
    },
    [onPdfChange],
  );

  return (
    <div className="w-full">
      {/* 主输入框容器 */}
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900',
          'border transition-all duration-200',
          'shadow-[0_10px_30px_rgba(15,23,42,0.06)]',
          'dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_14px_34px_rgba(0,0,0,0.22)]',
          isFocused || isDragging
            ? 'border-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.14),0_16px_40px_rgba(2,132,199,0.10)] dark:border-sky-500'
            : 'border-slate-200',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
          <div className="flex items-center gap-1">
            {/* 模板按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onTemplateClick} className={toolbarChipClass(false)}>
                  <Wand2 className="h-4 w-4" />
                  <span>模板</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>从模板快速创建</TooltipContent>
            </Tooltip>

            {/* 网页搜索 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-tour-step="home-websearch"
                  onClick={() => onWebSearchChange(!webSearch)}
                  className={toolbarChipClass(webSearch)}
                >
                  <Search className="h-4 w-4" />
                  <span>联网搜索</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>启用联网搜索获取最新信息</TooltipContent>
            </Tooltip>
          </div>

          {/* 互动模式 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-tour-step="home-interactive"
                onClick={() => onInteractiveModeChange(!interactiveMode)}
                className={toolbarChipClass(interactiveMode)}
              >
                <Atom className="h-4 w-4" />
                <span>互动模式</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>生成可互动的知识点讲解</TooltipContent>
          </Tooltip>
        </div>

        {/* 高级协作设置，默认收起，避免用户在开始前先理解 Agent */}
        <details className="border-b border-slate-100 dark:border-slate-800">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
            <span>教学角色与协作设置</span>
            <span className="text-xs text-slate-400">高级设置</span>
          </summary>
          <div className="px-3 pb-3">
            <AgentSelector
              selectedTeacherId={selectedTeacherId}
              selectedStudentIds={selectedStudentIds}
              onTeacherChange={onTeacherChange}
              onStudentsChange={onStudentsChange}
            />
          </div>
        </details>

        {/* 文本输入区 */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              isFocused || value.trim().length > 0
                ? '输入你想学的任何内容…'
                : `点这里，输入你想学的，例如：\n「${EXAMPLES[exIdx]}」`
            }
            className={cn(
              'w-full min-h-[160px] max-h-[320px] px-4 py-3',
              'bg-transparent resize-none',
              'text-[15px] leading-relaxed',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'focus:outline-none',
            )}
            rows={7}
          />

          {/* 拖拽提示 */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-sky-500/10"
              >
                <div className="flex flex-col items-center gap-2 text-sky-600 dark:text-sky-400">
                  <FileText className="h-8 w-8" />
                  <span className="text-sm font-medium">拖放 PDF 文件到这里</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PDF 预览 */}
        <AnimatePresence>
          {pdfFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-2"
            >
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
                  <FileText className="h-4 w-4 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                    {pdfFile.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => onPdfChange(null)}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
          <div className="flex items-center gap-1">
            {/* 上传 PDF */}
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  data-tour-step="home-pdf-upload"
                  className={cn(toolbarChipClass(false), 'cursor-pointer')}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>上传 PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onPdfChange(file);
                    }}
                  />
                </label>
              </TooltipTrigger>
              <TooltipContent>上传 PDF 作为参考资料</TooltipContent>
            </Tooltip>

            {/* 语音输入 */}
            <SpeechButton
              size="md"
              onTranscription={(text) => {
                onChange(value + (value ? ' ' : '') + text);
              }}
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="button"
            data-tour-step="home-submit"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all',
              canSubmit
                ? 'bg-sky-600 text-white hover:bg-sky-700 active:translate-y-px dark:bg-sky-500 dark:hover:bg-sky-400'
                : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
            )}
          >
            <span>开始讲解</span>
            <ArrowUp className={cn('h-4 w-4', canSubmit && '-rotate-45')} />
          </button>
        </div>
      </div>

      {/* 提示文字 */}
      <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
        按 Ctrl + Enter 快速创建 · 支持拖拽上传 PDF
      </p>
    </div>
  );
}
