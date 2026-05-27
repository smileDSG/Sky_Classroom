'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { TEMPLATE_PACKS, inferTemplateByTopic } from '@/lib/slides/template-packs';
import coverStyles from '@/public/template-previews/cover-styles.json';

interface TemplatePackGalleryProps {
  open: boolean;
  topic: string;
  recommendedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

interface CoverStyle {
  bg_color: string;
  accent_color: string;
  texts: string[];
  has_image: boolean;
  name: string;
}

const typedCoverStyles = coverStyles as Record<string, CoverStyle>;

/* ─── 封面预览组件（memo避免重渲染） ─── */
const CoverPreview = memo(function CoverPreview({ templateId }: { templateId: string }) {
  const style = typedCoverStyles[templateId];
  if (!style) return <div className="h-full w-full bg-slate-100 dark:bg-gray-800" />;

  const enTag = style.texts[0] || '';
  const title = style.texts[1] || '';
  const subtitle = style.texts[2] || '';

  const isDarkBg = ['#1E3A5F', '#070F1D', '#6B7F4A', '#E63946'].includes(style.bg_color.toUpperCase());
  const textColor = isDarkBg ? '#ffffff' : '#1e293b';
  const subColor = isDarkBg ? 'rgba(255,255,255,0.7)' : '#64748b';
  const accent = style.accent_color;

  const decorations: Record<string, React.ReactNode> = {
    'modern-geometric': (
      <>
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-[0.04]" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${accent} 0, ${accent} 1px, transparent 1px, transparent 12px)` }} />
        <div className="absolute right-3 top-3 w-10 h-10 border rotate-12" style={{ borderColor: accent, opacity: 0.15 }} />
        <div className="absolute right-10 bottom-6 w-6 h-6 rounded-full border" style={{ borderColor: accent, opacity: 0.12 }} />
      </>
    ),
    'cartoon': (
      <>
        <div className="absolute -right-3 -top-3 w-14 h-14 rounded-full" style={{ background: accent, opacity: 0.12 }} />
        <div className="absolute -left-2 -bottom-2 w-10 h-10 rounded-full" style={{ background: accent, opacity: 0.08 }} />
        <div className="absolute right-5 bottom-5 w-6 h-6 rounded-full" style={{ background: accent, opacity: 0.15 }} />
      </>
    ),
    'classical': (
      <>
        <div className="absolute right-2 bottom-2 text-5xl opacity-[0.06]" style={{ color: accent }}>印</div>
        <div className="absolute left-0 top-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)` }} />
        <div className="absolute left-0 bottom-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}20, transparent)` }} />
      </>
    ),
    'nordic': (
      <>
        <div className="absolute right-4 top-1/3 w-16 h-16 rounded-full opacity-[0.04]" style={{ background: accent }} />
        <div className="absolute left-3 bottom-3 right-3 h-px opacity-10" style={{ background: accent }} />
      </>
    ),
    'business': (
      <>
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-[0.03]" style={{ background: `linear-gradient(180deg, ${accent}, transparent)` }} />
        <div className="absolute left-0 bottom-0 w-full h-1 opacity-20" style={{ background: accent }} />
      </>
    ),
    'sports': (
      <>
        <div className="absolute -right-6 top-1/4 w-24 h-24 rounded-full border-4" style={{ borderColor: accent, opacity: 0.15 }} />
        <div className="absolute right-3 bottom-0 w-10 h-1" style={{ background: accent }} />
        <div className="absolute left-3 top-3 w-8 h-8 rounded-full opacity-10" style={{ background: accent }} />
      </>
    ),
    'ocean': (
      <>
        <div className="absolute bottom-0 left-0 right-0 h-10 opacity-20" style={{ background: `linear-gradient(to top, ${accent}, transparent)` }} />
        <div className="absolute right-3 top-1/4 w-16 h-16 rounded-full opacity-10" style={{ background: accent }} />
      </>
    ),
    'watercolor': (
      <>
        <div className="absolute -right-4 top-1/3 w-20 h-20 rounded-full blur-xl opacity-15" style={{ background: accent }} />
        <div className="absolute -left-3 bottom-1/4 w-14 h-14 rounded-full blur-lg opacity-10" style={{ background: accent }} />
      </>
    ),
    'nature': (
      <>
        <div className="absolute right-2 top-2 w-12 h-12 rounded-full opacity-10" style={{ background: accent }} />
        <div className="absolute left-2 bottom-2 w-8 h-8 rounded-full opacity-8" style={{ background: accent }} />
        <div className="absolute right-8 bottom-8 w-5 h-5 rounded-full opacity-12" style={{ background: accent }} />
      </>
    ),
    'humanistic': (
      <>
        <div className="absolute right-2 bottom-2 text-5xl opacity-[0.05]" style={{ color: accent }}>文</div>
        <div className="absolute left-0 top-1/2 w-full h-px opacity-5" style={{ background: accent }} />
      </>
    ),
    'vintage': (
      <>
        <div className="absolute left-2 top-2 right-2 bottom-2 border opacity-15" style={{ borderColor: accent }} />
        <div className="absolute left-3 top-3 right-3 bottom-3 border opacity-8" style={{ borderColor: accent }} />
      </>
    ),
    'tech': (
      <>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 23px, ${accent} 23px, ${accent} 24px)` }} />
        <div className="absolute right-3 top-3 w-12 h-px opacity-30" style={{ background: accent }} />
        <div className="absolute right-3 top-3 w-px h-12 opacity-30" style={{ background: accent }} />
        <div className="absolute left-3 bottom-3 w-8 h-px opacity-20" style={{ background: accent }} />
        <div className="absolute left-3 bottom-3 w-px h-8 opacity-20" style={{ background: accent }} />
      </>
    ),
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden flex flex-col justify-center px-3"
      style={{ background: style.bg_color }}
    >
      {decorations[templateId]}

      <div className="relative z-10">
        {enTag && (
          <div
            className="text-[7px] font-bold tracking-[0.25em] uppercase mb-1"
            style={{ color: accent, opacity: 0.85 }}
          >
            {enTag.length > 16 ? enTag.slice(0, 16) + '…' : enTag}
          </div>
        )}
        <div
          className="text-[13px] font-bold leading-tight mb-0.5 tracking-tight"
          style={{ color: textColor }}
        >
          {title.length > 8 ? title.slice(0, 8) + '…' : title}
        </div>
        {subtitle && (
          <div
            className="text-[8px] leading-relaxed"
            style={{ color: subColor }}
          >
            {subtitle.length > 12 ? subtitle.slice(0, 12) + '…' : subtitle}
          </div>
        )}
      </div>

      <div className="absolute bottom-1.5 left-3 right-3 h-[2px] rounded-full" style={{ background: accent, opacity: 0.25 }} />
    </div>
  );
});

/* ─── 主组件 ─── */
export function TemplatePackGallery({ open, topic, recommendedId, onSelect, onClose }: TemplatePackGalleryProps) {
  const [selected, setSelected] = useState<string>('');
  const [hovered, setHovered] = useState<string>('');

  useEffect(() => {
    if (open) {
      // 优先使用AI推断结果，否则fallback到本地关键词匹配
      const inferred = recommendedId && recommendedId.trim()
        ? recommendedId
        : inferTemplateByTopic(topic);
      setSelected(inferred);
      setHovered('');
    }
  }, [open, topic, recommendedId]);

  const handleConfirm = useCallback(() => {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  }, [selected, onSelect, onClose]);

  if (!open) return null;

  const availablePacks = TEMPLATE_PACKS.filter((t) => t.available);
  const selectedName = availablePacks.find(t => t.id === selected)?.name || '未选择';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
        onClick={onClose}
        style={{ animation: 'tgFadeIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards' }}
      />

      {/* 弹窗主体 */}
      <div
        className="relative z-10 flex w-full max-w-4xl max-h-[85vh] flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl shadow-slate-900/20 overflow-hidden"
        style={{ animation: 'tgSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/80 dark:border-gray-700/80 bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-gray-100 tracking-tight">选择课件模板</h2>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-gray-500">
              {topic ? `根据"${topic}"推荐「${selectedName}」` : '请选择课件风格'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 transition-all duration-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 模板网格 — 隐藏滚动条 */}
        <div
          className="flex-1 overflow-y-auto p-5 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {availablePacks.map((tp) => {
              const isSelected = selected === tp.id;
              const isHovered = hovered === tp.id;
              const style = typedCoverStyles[tp.id];

              return (
                <button
                  key={tp.id}
                  onClick={() => setSelected(tp.id)}
                  onMouseEnter={() => setHovered(tp.id)}
                  onMouseLeave={() => setHovered('')}
                  className="group relative flex flex-col rounded-xl border text-left transition-all duration-200 will-change-transform"
                  style={{
                    borderColor: isSelected ? style?.accent_color || '#3b82f6' : 'transparent',
                    background: isSelected ? `${style?.accent_color || '#3b82f6'}08` : 'transparent',
                    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: isSelected
                      ? `0 0 0 1.5px ${style?.accent_color || '#3b82f6'}, 0 8px 24px -6px ${style?.accent_color || '#3b82f6'}30`
                      : isHovered
                        ? '0 8px 24px -8px rgba(0,0,0,0.12)'
                        : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* 封面预览 */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl">
                    <CoverPreview templateId={tp.id} />

                    {/* 选中角标 */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full shadow-md"
                        style={{ background: style?.accent_color || '#3b82f6' }}
                      >
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* 推荐标签 — 仅显示在AI推荐模板上，不随用户切换而移动 */}
                    {recommendedId && tp.id === recommendedId && (
                      <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm"
                        style={{ background: style?.accent_color || '#3b82f6' }}
                      >
                        <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        推荐
                      </div>
                    )}
                  </div>

                  {/* 信息区 */}
                  <div className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ background: style?.accent_color || '#3b82f6' }}
                      />
                      <span className={`text-[13px] font-bold truncate tracking-tight ${isSelected ? 'text-slate-800 dark:text-gray-100' : 'text-slate-700 dark:text-gray-300'}`}>
                        {tp.name}
                      </span>
                    </div>
                    <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-gray-500 truncate pl-3">
                      {tp.subjectTags.slice(0, 3).join(' · ')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100/80 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-800/50">
          <span className="text-xs text-slate-400 dark:text-gray-500">
            已选 <span className="font-semibold" style={{ color: typedCoverStyles[selected]?.accent_color || '#3b82f6' }}>{selectedName}</span>
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-slate-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200 hover:shadow-sm transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="rounded-lg px-5 py-1.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-px active:translate-y-0 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{
                background: selected
                  ? `linear-gradient(135deg, ${typedCoverStyles[selected]?.accent_color || '#3b82f6'}, ${typedCoverStyles[selected]?.accent_color || '#6366f1'})`
                  : '#94a3b8',
              }}
            >
              确认生成
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none !important;
        }
        .scrollbar-hide {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        @keyframes tgFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tgSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
