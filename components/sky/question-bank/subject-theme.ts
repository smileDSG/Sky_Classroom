/** Subject color theme mapping for question bank UI. */

export const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  数学:   { bg: 'bg-blue-50',      text: 'text-blue-700',      border: 'border-blue-200',      bar: 'bg-blue-500' },
  物理:   { bg: 'bg-emerald-50',   text: 'text-emerald-700',   border: 'border-emerald-200',   bar: 'bg-emerald-500' },
  化学:   { bg: 'bg-orange-50',    text: 'text-orange-700',    border: 'border-orange-200',    bar: 'bg-orange-500' },
  生物:   { bg: 'bg-rose-50',      text: 'text-rose-700',      border: 'border-rose-200',      bar: 'bg-rose-400' },
  语文:   { bg: 'bg-violet-50',    text: 'text-violet-700',    border: 'border-violet-200',    bar: 'bg-violet-500' },
  英语:   { bg: 'bg-indigo-50',    text: 'text-indigo-700',    border: 'border-indigo-200',    bar: 'bg-indigo-500' },
  历史:   { bg: 'bg-amber-50',     text: 'text-amber-700',     border: 'border-amber-200',     bar: 'bg-amber-600' },
  地理:   { bg: 'bg-cyan-50',      text: 'text-cyan-700',      border: 'border-cyan-200',      bar: 'bg-cyan-500' },
  政治:   { bg: 'bg-red-50',       text: 'text-red-700',       border: 'border-red-200',       bar: 'bg-red-500' },
  信息技术: { bg: 'bg-slate-50',    text: 'text-slate-700',     border: 'border-slate-200',     bar: 'bg-slate-500' },
};

export function getSubjectTheme(subject: string) {
  return SUBJECT_COLORS[subject] ?? {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    bar: 'bg-gray-400',
  };
}

export const DIFFICULTY_STARS: Record<string, string> = {
  easy: '⭐',
  medium: '⭐⭐',
  hard: '⭐⭐⭐',
};

export const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: '简单', color: 'text-green-600',  bg: 'bg-green-50' },
  medium: { label: '中等', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  hard:   { label: '困难', color: 'text-red-600',    bg: 'bg-red-50' },
};
