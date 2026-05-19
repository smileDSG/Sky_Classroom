'use client';

import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

const SUBJECT_OPTIONS = [
  { label: '数学', value: '数学' },
  { label: '物理', value: '物理' },
  { label: '化学', value: '化学' },
  { label: '语文', value: '语文' },
  { label: '英语', value: '英语' },
] as const;

const STYLE_OPTIONS = [
  { label: '详细', value: 'detailed' },
  { label: '简洁', value: 'concise' },
  { label: '启发式', value: 'heuristic' },
] as const;

const DIFFICULTY_OPTIONS = [
  { label: '初中', value: 'junior' },
  { label: '高中', value: 'senior' },
  { label: '大学', value: 'college' },
] as const;

export function AssistantConfig() {
  const subject = useSkyClassroomStore((s) => s.subject);
  const style = useSkyClassroomStore((s) => s.style);
  const difficulty = useSkyClassroomStore((s) => s.difficulty);
  const setSubject = useSkyClassroomStore((s) => s.setSubject);
  const setStyle = useSkyClassroomStore((s) => s.setStyle);
  const setDifficulty = useSkyClassroomStore((s) => s.setDifficulty);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">助手配置</p>
      <div className="flex items-center gap-3">
        {/* Subject Selector */}
        <div className="flex-1">
          <label className="mb-1.5 block text-xs text-gray-500">学科</label>
          <div className="flex gap-1">
            {SUBJECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSubject(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  subject === opt.value
                    ? 'bg-[#4A90D9] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style Selector */}
        <div className="shrink-0">
          <label className="mb-1.5 block text-xs text-gray-500">风格</label>
          <div className="flex gap-1">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStyle(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  style === opt.value
                    ? 'bg-[#4A90D9] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="shrink-0">
          <label className="mb-1.5 block text-xs text-gray-500">难度</label>
          <div className="flex gap-1">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  difficulty === opt.value
                    ? 'bg-[#4A90D9] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
