'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUp,
  Sparkles,
  Atom,
  ImageIcon,
  FileText,
  X,
  Mic,
  Search,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpeechButton } from '@/components/audio/speech-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AgentSelector } from './agent-selector';

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
}) {const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }
    },
    [canSubmit, onSubmit]
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
    [onPdfChange]
  );

  return (
    <div className="w-full">
      {/* 主输入框容器 */}
      <div
        className={cn(
          'relative rounded-3xl overflow-hidden',
          'bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl',
          'border transition-all duration-300',
          isFocused || isDragging
            ? 'border-sky-400/50 shadow-2xl shadow-sky-500/20 dark:shadow-sky-900/30'
            : 'border-slate-200/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/30 dark:shadow-slate-900/20',
          isDragging && 'ring-2 ring-sky-400/50 ring-offset-2'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            {/* 模板按钮 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onTemplateClick}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl',
                    'text-sm font-medium',
                    'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20',
                    'text-violet-600 dark:text-violet-400',
                    'border border-violet-200/50 dark:border-violet-700/30',
                    'hover:shadow-md hover:shadow-violet-500/10',
                    'transition-all duration-200'
                  )}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>模板</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>从模板快速创建</TooltipContent>
            </Tooltip>

            {/* 网页搜索 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onWebSearchChange(!webSearch)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl',
                    'text-sm font-medium transition-all duration-200',
                    webSearch
                      ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-700/50'
                      : 'bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  )}
                >
                  <Search className="w-4 h-4" />
                  <span>联网搜索</span>
                  {webSearch && (
                    <motion.div
                      layoutId="check"
                      className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center"
                    >
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>启用联网搜索获取最新信息</TooltipContent>
            </Tooltip>
          </div>

          {/* 互动模式 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onInteractiveModeChange(!interactiveMode)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl',
                  'text-sm font-medium transition-all duration-200',
                  interactiveMode
                    ? 'bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700/50 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                )}
              >
                <motion.div
                  animate={interactiveMode ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: interactiveMode ? Infinity : 0, ease: 'linear' }}
                >
                  <Atom className="w-4 h-4" />
                </motion.div>
                <span>互动模式</span>
                {interactiveMode && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                  </span>
                )}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent>创建可交互的沉浸式课堂</TooltipContent>
          </Tooltip>
        </div>

        {/* 角色选择器 */}
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
          <AgentSelector
            selectedTeacherId={selectedTeacherId}
            selectedStudentIds={selectedStudentIds}
            onTeacherChange={onTeacherChange}
            onStudentsChange={onStudentsChange}
          />
        </div>

        {/* 文本输入区 */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={`输入你想学的任何内容，例如：
「从零学 Python，30 分钟写出第一个程序」
「用白板给我讲解傅里叶变换」
「阿瓦隆桌游怎么玩」`}
            className={cn(
              'w-full px-3 py-3 min-h-[226px] max-h-[400px]',
              'bg-transparent resize-none',
              'text-[15px] leading-relaxed',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'focus:outline-none'
            )}
            rows={9}
          />

          {/* 拖拽提示 */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-sky-500/10 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center gap-2 text-sky-600 dark:text-sky-400">
                  <FileText className="w-8 h-8" />
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
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {pdfFile.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => onPdfChange(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            {/* 上传 PDF */}
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer',
                    'text-sm text-slate-600 dark:text-slate-400',
                    'hover:bg-slate-100 dark:hover:bg-slate-700/50',
                    'transition-colors'
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
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
          <motion.button
            whileHover={canSubmit ? { scale: 1.02 } : {}}
            whileTap={canSubmit ? { scale: 0.98 } : {}}
            onClick={onSubmit}
            disabled={!canSubmit}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl',
              'text-sm font-semibold',
              'transition-all duration-200',
              canSubmit
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:shadow-sky-500/30'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            )}
          >
            <span>创建课堂</span>
            <ArrowUp className={cn('w-4 h-4', canSubmit && '-rotate-45')} />
          </motion.button>
        </div>
      </div>

      {/* 提示文字 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-4 text-xs text-slate-400"
      >
        按 Cmd + Enter 快速创建 · 支持拖拽上传 PDF
      </motion.p>
    </div>
  );
}
