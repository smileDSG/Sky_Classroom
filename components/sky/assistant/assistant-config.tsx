'use client';

import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useI18n } from '@/lib/hooks/use-i18n';

export function AssistantConfig() {
  const { t } = useI18n();
  const subject = useSkyClassroomStore((s) => s.subject);
  const style = useSkyClassroomStore((s) => s.style);
  const difficulty = useSkyClassroomStore((s) => s.difficulty);
  const setSubject = useSkyClassroomStore((s) => s.setSubject);
  const setStyle = useSkyClassroomStore((s) => s.setStyle);
  const setDifficulty = useSkyClassroomStore((s) => s.setDifficulty);

  const SUBJECT_OPTIONS = [
    { label: t('sky.assistant.subjects.math'), value: '数学' as const },
    { label: t('sky.assistant.subjects.physics'), value: '物理' as const },
    { label: t('sky.assistant.subjects.chemistry'), value: '化学' as const },
    { label: t('sky.assistant.subjects.chinese'), value: '语文' as const },
    { label: t('sky.assistant.subjects.english'), value: '英语' as const },
  ];

  const STYLE_OPTIONS = [
    { label: t('sky.assistant.styles.detailed'), value: 'detailed' as const },
    { label: t('sky.assistant.styles.concise'), value: 'concise' as const },
    { label: t('sky.assistant.styles.heuristic'), value: 'heuristic' as const },
  ];

  const DIFFICULTY_OPTIONS = [
    { label: t('sky.assistant.grades.junior'), value: 'junior' as const },
    { label: t('sky.assistant.grades.senior'), value: 'senior' as const },
    { label: t('sky.assistant.grades.college'), value: 'college' as const },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xl">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">{t('sky.assistant.configTitle')}</p>
      <div className="flex items-center gap-3">
        {/* Subject Selector */}
        <div className="flex-1">
          <label className="mb-1.5 block text-xs text-gray-500">{t('sky.assistant.subjectLabel')}</label>
          <div className="flex gap-1">
            {SUBJECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSubject(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  subject === opt.value
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
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
          <label className="mb-1.5 block text-xs text-gray-500">{t('sky.assistant.styleLabel')}</label>
          <div className="flex gap-1">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStyle(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  style === opt.value
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
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
          <label className="mb-1.5 block text-xs text-gray-500">{t('sky.assistant.difficultyLabel')}</label>
          <div className="flex gap-1">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  difficulty === opt.value
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
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
