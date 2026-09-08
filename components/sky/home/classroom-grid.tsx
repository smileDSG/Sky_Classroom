'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  Clock,
  MoreHorizontal,
  Trash2,
  Pencil,
  Copy,
  ChevronRight,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { StageListItem } from '@/lib/utils/stage-storage';
import { Slide } from '@/lib/types/slides';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

// 课堂卡片组件
function ClassroomCard({
  classroom,
  slide,
  index,
  formatDate,
  onDelete,
  onRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  viewMode,
}: {
  classroom: StageListItem;
  slide?: Slide;
  index: number;
  formatDate: (ts: number) => string;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  viewMode: 'grid' | 'list';
}) {
  const router = useRouter();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(classroom.name);
    setIsEditing(true);
  };

  const commitRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) {
      onRename(classroom.id, trimmed);
    }
    setIsEditing(false);
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="group relative"
      >
        <div
          onClick={() => router.push(`/classroom/${classroom.id}`)}
          onMouseEnter={() => {
            router.prefetch(`/classroom/${classroom.id}`);
            setIsHovered(true);
          }}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex items-center gap-4 p-4 rounded-2xl cursor-pointer',
            'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm',
            'border border-slate-200/50 dark:border-slate-700/50',
            'hover:bg-white/80 dark:hover:bg-slate-800/80',
            'hover:shadow-lg hover:shadow-slate-200/30 dark:hover:shadow-slate-900/30',
            'transition-all duration-300',
          )}
        >
          {/* 缩略图 */}
          <div className="relative w-24 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
            {slide ? (
              <ThumbnailSlide
                slide={slide}
                size={96}
                viewportSize={slide.viewportSize ?? 1000}
                viewportRatio={slide.viewportRatio ?? 0.5625}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg opacity-50">📄</span>
              </div>
            )}
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm font-semibold bg-transparent border-b-2 border-sky-400 focus:outline-none"
                autoFocus
              />
            ) : (
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {classroom.name}
              </h3>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span>
                {classroom.sceneCount} {'页'}
              </span>
              <span>·</span>
              <span>{formatDate(classroom.updatedAt)}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <AnimatePresence>
            {isHovered && !confirmingDelete && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-1"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={startRename}
                      className="p-2 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>重命名</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(classroom.id);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>删除</TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 删除确认 */}
          <AnimatePresence>
            {confirmingDelete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm text-slate-600 dark:text-slate-300">{'删除课堂'}?</span>
                <button
                  onClick={onCancelDelete}
                  className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  {'取消'}
                </button>
                <button
                  onClick={onConfirmDelete}
                  className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white"
                >
                  {'删除'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // Grid view
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative"
    >
      <div
        onClick={() => router.push(`/classroom/${classroom.id}`)}
        onMouseEnter={() => {
          router.prefetch(`/classroom/${classroom.id}`);
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative cursor-pointer rounded-2xl overflow-hidden',
          'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm',
          'border border-slate-200/50 dark:border-slate-700/50',
          'hover:shadow-xl hover:shadow-sky-500/10 dark:hover:shadow-sky-900/20',
          'transition-all duration-300',
        )}
      >
        {/* 缩略图区域 */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <div
            ref={thumbRef}
            className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800"
          >
            {slide ? (
              <ThumbnailSlide
                slide={slide}
                size={400}
                viewportSize={slide.viewportSize ?? 1000}
                viewportRatio={slide.viewportRatio ?? 0.5625}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center">
                  <span className="text-2xl opacity-50">📄</span>
                </div>
              </div>
            )}
          </div>

          {/* 悬停遮罩 */}
          <AnimatePresence>
            {isHovered && !confirmingDelete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
              >
                {/* 操作按钮 */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={startRename}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>重命名</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(classroom.name);
                          toast.success('课堂名称已复制');
                        }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>复制名称</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(classroom.id);
                        }}
                        className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-sm transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>删除</TooltipContent>
                  </Tooltip>
                </div>

                {/* 打开提示 */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1 text-white/80 text-sm">
                  <span>打开</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 删除确认 */}
          <AnimatePresence>
            {confirmingDelete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-medium text-white">{'删除课堂'}?</span>
                <div className="flex gap-2">
                  <button
                    onClick={onCancelDelete}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium bg-white/20 text-white hover:bg-white/30 transition-colors"
                  >
                    {'取消'}
                  </button>
                  <button
                    onClick={onConfirmDelete}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    {'删除'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 信息区域 */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1 -mx-2 text-sm font-semibold bg-slate-100 dark:bg-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-sky-400"
                  autoFocus
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {classroom.name}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {classroom.name}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
              {classroom.sceneCount} {'页'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(classroom.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// 课堂列表组件
export function ClassroomGrid({
  classrooms,
  thumbnails,
  formatDate,
  onDelete,
  onRename,
}: {
  classrooms: StageListItem[];
  thumbnails: Record<string, Slide>;
  formatDate: (ts: number) => string;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, newName: string) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const filteredClassrooms = searchQuery
    ? classrooms.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : classrooms;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{'最近学习'}</h2>
            <p className="text-sm text-slate-500">共 {classrooms.length} 个课堂</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索课堂..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-9 pr-4 py-2 rounded-xl text-sm bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all"
            />
          </div>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg transition-all',
                viewMode === 'grid'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-lg transition-all',
                viewMode === 'list'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 空状态 */}
      {filteredClassrooms.length === 0 && (
        <div className="text-center py-16">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex flex-col items-center gap-4"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500">
              {searchQuery ? '没有找到匹配的课堂' : '还没有创建课堂，开始创建吧！'}
            </p>
          </motion.div>
        </div>
      )}

      {/* 列表 */}
      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'flex flex-col gap-3',
        )}
      >
        {filteredClassrooms.map((classroom, index) => (
          <ClassroomCard
            key={classroom.id}
            classroom={classroom}
            slide={thumbnails[classroom.id]}
            index={index}
            formatDate={formatDate}
            onDelete={(id) => setConfirmingDelete(id)}
            onRename={onRename}
            confirmingDelete={confirmingDelete === classroom.id}
            onConfirmDelete={() => {
              onDelete(classroom.id);
              setConfirmingDelete(null);
            }}
            onCancelDelete={() => setConfirmingDelete(null)}
            viewMode={viewMode}
          />
        ))}
      </div>
    </motion.div>
  );
}
