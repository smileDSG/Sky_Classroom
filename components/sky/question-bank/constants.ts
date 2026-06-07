export interface SubjectOption {
  id: string;
  label: string;
  color: string;
  bg: string;
  ring: string;
}

export const SUBJECTS: SubjectOption[] = [
  { id: '', label: '全部', color: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-300' },
  { id: '数学', label: '数学', color: 'text-violet-600', bg: 'bg-violet-100', ring: 'ring-violet-300' },
  { id: '物理', label: '物理', color: 'text-sky-600', bg: 'bg-sky-100', ring: 'ring-sky-300' },
  { id: '化学', label: '化学', color: 'text-emerald-600', bg: 'bg-emerald-100', ring: 'ring-emerald-300' },
  { id: '生物', label: '生物', color: 'text-green-600', bg: 'bg-green-100', ring: 'ring-green-300' },
  { id: '语文', label: '语文', color: 'text-rose-600', bg: 'bg-rose-100', ring: 'ring-rose-300' },
  { id: '英语', label: '英语', color: 'text-amber-600', bg: 'bg-amber-100', ring: 'ring-amber-300' },
  { id: '历史', label: '历史', color: 'text-orange-600', bg: 'bg-orange-100', ring: 'ring-orange-300' },
  { id: '地理', label: '地理', color: 'text-cyan-600', bg: 'bg-cyan-100', ring: 'ring-cyan-300' },
  { id: '政治', label: '政治', color: 'text-indigo-600', bg: 'bg-indigo-100', ring: 'ring-indigo-300' },
];

export interface DifficultyOption {
  id: string;
  label: string;
  badgeClass: string;
}

export const DIFFICULTIES: DifficultyOption[] = [
  { id: '', label: '全部', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  { id: 'easy', label: '基础', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { id: 'medium', label: '进阶', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { id: 'hard', label: '挑战', badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
];

export interface TypeOption {
  id: string;
  label: string;
}

export const QUESTION_TYPES: TypeOption[] = [
  { id: '', label: '全部题型' },
  { id: 'choice', label: '选择题' },
  { id: 'fill', label: '填空题' },
  { id: 'solve', label: '解答题' },
  { id: 'judge', label: '判断题' },
];

export function difficultyLabel(difficulty: string): string {
  return DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? difficulty;
}

export function difficultyBadgeClass(difficulty: string): string {
  return DIFFICULTIES.find((d) => d.id === difficulty)?.badgeClass ?? DIFFICULTIES[0].badgeClass;
}

export function typeLabel(type: string): string {
  return QUESTION_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function subjectOption(subject: string): SubjectOption | undefined {
  return SUBJECTS.find((s) => s.id === subject);
}
