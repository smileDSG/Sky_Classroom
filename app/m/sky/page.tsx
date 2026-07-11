'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import {
  Atom,
  ArrowUp,
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  Camera,
  ChevronDown,
  FileText,
  GraduationCap,
  MessageSquare,
  Presentation,
  Search,
  Sparkles,
  UserRound,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileThemeControl } from '@/components/mobile/mobile-theme-control';
import { useTheme } from '@/lib/hooks/use-theme';
import { useAuth } from '@/components/auth/auth-provider';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import { submitClassroomJob } from '@/lib/classroom/classroom-job-client';
import { addActiveJobEntry } from '@/lib/classroom/classroom-session';
import { useSettingsStore } from '@/lib/store/settings';
import { useTaskStore } from '@/lib/store/use-task-store';
import { storePdfBlob } from '@/lib/utils/image-storage';
import { SpeechButton } from '@/components/audio/speech-button';
import { STUDENT_OPTIONS, TEACHER_OPTIONS } from '@/components/sky/home/agent-selector';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { MobileStudyCompanionCarousel } from '@/components/mobile/home/mobile-study-companion-carousel';

function getGreeting(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) {
    if (hour >= 5 && hour < 12) return '早上好，同学';
    if (hour >= 12 && hour < 18) return '下午好，同学';
    if (hour >= 18 && hour < 22) return '晚上好，同学';
    return '夜深了，注意休息';
  }
  if (hour >= 5 && hour < 12) return '早上好，同学';
  if (hour >= 12 && hour < 18) return '下午好，同学';
  if (hour >= 18 && hour < 22) return '晚上好，同学';
  return '夜深了，注意休息';
}

const cloudTools: {
  icon: ElementType;
  label: string;
  desc: string;
  href: string;
  gradient: string;
  glow: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    icon: Presentation,
    label: 'PPT 课件',
    desc: '整理成课堂课件',
    href: '/m/sky/cloud-mind/slides',
    gradient: 'from-sky-500/28 via-blue-500/22 to-cyan-400/24',
    glow: 'bg-sky-300/24',
    iconBg: 'bg-sky-400/24 ring-sky-300/40',
    iconColor: 'text-sky-100',
  },
  {
    icon: Search,
    label: '拍照搜题',
    desc: '拍照提取题目解析',
    href: '/m/sky/cloud-mind/solve',
    gradient: 'from-amber-500/26 via-orange-500/20 to-yellow-400/24',
    glow: 'bg-amber-300/22',
    iconBg: 'bg-amber-400/24 ring-amber-300/40',
    iconColor: 'text-amber-100',
  },
  {
    icon: MessageSquare,
    label: '互动课堂',
    desc: '角色参与讲解',
    href: '/m/sky/assistant',
    gradient: 'from-emerald-500/28 via-teal-500/20 to-cyan-400/22',
    glow: 'bg-emerald-300/22',
    iconBg: 'bg-emerald-400/24 ring-emerald-300/40',
    iconColor: 'text-emerald-100',
  },
];

const studyCards: {
  icon: ElementType;
  title: string;
  desc: string;
  href: string;
  color: string;
  tag: string;
  tagColor: string;
}[] = [
  {
    icon: GraduationCap,
    title: '知识图谱',
    desc: '把学习路径拆成清晰节点',
    href: '/m/sky/learning/graph',
    color: 'from-sky-500 to-blue-500',
    tag: '进阶',
    tagColor: 'bg-sky-500',
  },
  {
    icon: FileText,
    title: '错题复盘',
    desc: '同步练习记录并整理复习建议',
    href: '/m/sky/learning/mistakes',
    color: 'from-amber-500 to-orange-500',
    tag: '巩固',
    tagColor: 'bg-amber-500',
  },
  {
    icon: UserRound,
    title: '学习档案',
    desc: '查看掌握度、打卡和成长轨迹',
    href: '/m/sky/learning/profile',
    color: 'from-emerald-500 to-teal-500',
    tag: '成长',
    tagColor: 'bg-emerald-500',
  },
];

const dailyQuotes = [
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '知识就是力量。', author: '培根' },
  { text: '我思故我在。', author: '笛卡尔' },
  { text: '学而时习之，不亦说乎？', author: '孔子' },
];

const funFacts = [
  '人脑的神经连接数量比银河系的星星还多',
  '光从太阳到地球需要约8分20秒',
  '蜜蜂可以识别人类的面孔',
  '宇宙的年龄约为138亿年',
];

const mobileTemplates = [
  {
    title: 'Python 入门课',
    desc: '适合零基础，30 分钟做出第一个小程序',
    prompt:
      '从零学 Python，30 分钟写出第一个程序。请用互动课堂方式讲解变量、输入输出和一个小游戏案例。',
  },
  {
    title: '傅里叶变换',
    desc: '用白板和类比讲清抽象概念',
    prompt: '用白板给我讲解傅里叶变换，要求从声音和波形的直观例子讲起，逐步过渡到公式含义。',
  },
  {
    title: '桌游规则课',
    desc: '把复杂规则讲成可操作步骤',
    prompt: '阿瓦隆桌游怎么玩？请按角色、流程、胜负条件、常见策略做一节互动课堂。',
  },
];

function MobileCloudMindSection() {
  return (
    <section
      data-testid="mobile-home-cloud-tools"
      aria-label="云端智囊首页工具"
      className="space-y-2.5"
    >
      <div className="flex items-end justify-between px-0.5">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-sky-300/70">学习工具</p>
          <h2 className="mt-1 text-[18px] font-bold leading-none text-white">云端智囊</h2>
        </div>
        <Link
          href="/m/sky/cloud-mind"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-400"
        >
          全部能力
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {cloudTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.label}
              href={tool.href}
              className={`mobile-tactile-card relative min-h-[92px] overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br ${tool.gradient} p-2 transition-transform duration-200 active:scale-[0.98] motion-safe:hover:-translate-y-0.5`}
            >
              <div
                className={`absolute -right-7 -top-7 size-16 rounded-full ${tool.glow} blur-2xl`}
              />
              <div className="absolute bottom-2 right-2 size-10 rounded-full bg-white/7" />
              <span
                className={`mobile-tool-token relative flex size-8 items-center justify-center rounded-[14px] ring-1 ${tool.iconBg}`}
              >
                <Icon className={`size-4 ${tool.iconColor}`} />
              </span>
              <span className="relative mt-3.5 block text-[13px] font-extrabold leading-tight text-white">
                {tool.label}
              </span>
              <span className="relative mt-0.5 block text-[11px] leading-snug text-white/62">
                {tool.desc}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MobileStudyCompanionSection() {
  const quote = useMemo(() => {
    const today = new Date();
    return dailyQuotes[(today.getDate() + today.getMonth()) % dailyQuotes.length];
  }, []);
  const initialFactIndex = useMemo(() => new Date().getDate() % funFacts.length, []);

  return (
    <section className="space-y-2.5">
      <div>
        <div className="mb-2 flex items-center gap-2 px-0.5">
          <GraduationCap className="size-3.5 text-sky-400" />
          <h3 className="text-[14px] font-semibold text-slate-100">学习补给</h3>
          <span className="text-[12px] text-slate-400">— 每天轻量复盘</span>
        </div>
        <div className="-mx-1 flex touch-pan-x snap-x gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {studyCards.map((topic) => {
            const Icon = topic.icon;
            return (
              <Link
                key={topic.title}
                href={topic.href}
                className={`mobile-tactile-card relative min-h-[78px] w-[150px] shrink-0 snap-start overflow-hidden rounded-[16px] bg-gradient-to-br ${topic.color} p-2.5 shadow-lg transition-transform duration-200 active:scale-[0.98] motion-safe:hover:-translate-y-0.5`}
              >
                <div className="absolute -bottom-8 -right-8 size-24 rounded-full bg-white/10" />
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '16px 16px',
                  }}
                />
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${topic.tagColor}`}
                >
                  {topic.tag}
                </span>
                <Icon className="relative mb-1.5 size-4 text-white/90" />
                <p className="relative line-clamp-2 text-[12px] font-bold leading-snug text-white">
                  {topic.title}
                </p>
                <p className="relative mt-0.5 truncate text-[11px] text-white/72">{topic.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <MobileStudyCompanionCarousel
        quote={quote}
        facts={funFacts}
        initialFactIndex={initialFactIndex}
      />
    </section>
  );
}

function MobileSkyTeachingSection({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/65 bg-white/55 p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-sky-100/70 backdrop-blur-xl dark:border-sky-200/12 dark:bg-[#091523]/72 dark:shadow-[0_14px_34px_rgba(2,8,23,0.28)] dark:ring-sky-200/8">
      <div className="pointer-events-none absolute -right-14 -top-16 size-36 rounded-full bg-sky-300/10 blur-3xl dark:bg-sky-400/8" />
      <div className="relative mb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[15px] border border-sky-200/70 bg-sky-100/70 text-sky-600 shadow-sm shadow-sky-900/5 dark:border-sky-300/28 dark:bg-sky-400/14 dark:text-sky-200">
            <GraduationCap className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-extrabold leading-tight text-slate-900 dark:text-white">
              天穹授课
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              输入主题，生成一节可互动的课堂
            </p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function MobileCreateClassroomCard({
  value,
  onChange,
  onSubmit,
  pdfFile,
  onPdfChange,
  webSearch,
  onWebSearchChange,
  interactiveMode,
  onInteractiveModeChange,
  selectedTeacherId,
  selectedStudentIds,
  onTeacherChange,
  onStudentsChange,
  isSubmitting,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pdfFile: File | null;
  onPdfChange: (file: File | null) => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  interactiveMode: boolean;
  onInteractiveModeChange: (enabled: boolean) => void;
  selectedTeacherId: string;
  selectedStudentIds: string[];
  onTeacherChange: (teacherId: string) => void;
  onStudentsChange: (studentIds: string[]) => void;
  isSubmitting: boolean;
}) {
  const [rolePanelOpen, setRolePanelOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const selectedTeacher = TEACHER_OPTIONS.find((teacher) => teacher.id === selectedTeacherId);
  const selectedStudents = STUDENT_OPTIONS.filter((student) =>
    selectedStudentIds.includes(student.id),
  );

  const toggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      onStudentsChange(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      onStudentsChange([...selectedStudentIds, studentId]);
    }
  };

  return (
    <section className="overflow-hidden rounded-[20px] border border-slate-600/60 bg-[#172436] shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTemplatePanelOpen(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/18 px-2.5 text-[12px] font-semibold text-violet-200"
          >
            <Wand2 className="size-3" />
            模板
          </button>
          <button
            type="button"
            onClick={() => onWebSearchChange(!webSearch)}
            className={`inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium ${
              webSearch
                ? 'bg-sky-500/18 text-sky-200 ring-1 ring-sky-400/30'
                : 'bg-slate-700/55 text-slate-300'
            }`}
          >
            <Search className="size-3 shrink-0 text-slate-400" />
            <span className="truncate">联网搜索</span>
            {webSearch && <span className="size-1.5 rounded-full bg-sky-300" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onInteractiveModeChange(!interactiveMode)}
          className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold ${
            interactiveMode
              ? 'border-cyan-300/50 bg-cyan-500/18 text-cyan-100'
              : 'border-cyan-400/35 bg-cyan-500/12 text-cyan-200'
          }`}
        >
          <Atom className="size-3" />
          互动
          {interactiveMode && <span className="size-1.5 rounded-full bg-cyan-300" />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setRolePanelOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 border-b border-white/8 px-2.5 py-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex -space-x-2">
            {selectedTeacher && (
              <img
                src={selectedTeacher.avatar}
                alt={selectedTeacher.name}
                className="size-7 rounded-full border-2 border-[#172436] object-cover"
              />
            )}
            {selectedStudents.slice(0, 2).map((student) => (
              <img
                key={student.id}
                src={student.avatar}
                alt={student.name}
                className="size-7 rounded-full border-2 border-[#172436] object-cover"
              />
            ))}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-slate-100">
              {selectedTeacher?.name ?? '默认老师'} · {selectedStudentIds.length} 位学生
            </p>
            <p className="mt-0.5 truncate text-[12px] text-slate-400">点击配置课堂角色</p>
          </div>
        </div>
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>

      {rolePanelOpen && (
        <div className="space-y-3 border-b border-white/8 px-3 py-3">
          <div>
            <p className="mb-2 text-[12px] font-semibold text-sky-200">选择老师</p>
            <div className="grid grid-cols-2 gap-2">
              {TEACHER_OPTIONS.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => onTeacherChange(teacher.id)}
                  className={`rounded-2xl border px-3 py-2 text-left ${
                    selectedTeacherId === teacher.id
                      ? 'border-sky-300/60 bg-sky-400/15'
                      : 'border-white/10 bg-white/6'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <img
                      src={teacher.avatar}
                      alt={teacher.name}
                      className="size-8 shrink-0 rounded-xl object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold text-white">
                        {teacher.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-slate-400">
                        {teacher.description}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-semibold text-violet-200">选择同学</p>
            <div className="grid grid-cols-2 gap-2">
              {STUDENT_OPTIONS.map((student) => {
                const selected = selectedStudentIds.includes(student.id);
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => toggleStudent(student.id)}
                    className={`rounded-2xl border px-3 py-2 text-left ${
                      selected
                        ? 'border-violet-300/60 bg-violet-400/15'
                        : 'border-white/10 bg-white/6'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <img
                        src={student.avatar}
                        alt={student.name}
                        className="size-8 shrink-0 rounded-xl object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold text-white">
                          {student.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-slate-400">
                          {student.description}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div>
        <textarea
          rows={5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={`输入你想学的任何内容，例如：
「从零学 Python，30 分钟写出第一个程序」
「用白板给我讲解傅里叶变换」
「阿瓦隆桌游怎么玩」`}
          className="min-h-[132px] w-full resize-none bg-transparent px-2.5 py-2.5 text-[14px] leading-5 text-slate-100 outline-none placeholder:text-slate-500"
        />

        <div className="space-y-2 border-t border-white/8 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-slate-400">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 text-[12px] font-medium">
              <FileText className="size-3" />
              <span className="max-w-[70px] truncate">{pdfFile ? pdfFile.name : '上传 PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(event) => onPdfChange(event.target.files?.[0] ?? null)}
              />
            </label>
            {pdfFile && (
              <button
                type="button"
                aria-label="移除 PDF"
                onClick={() => onPdfChange(null)}
                className="flex size-7 items-center justify-center rounded-full bg-white/6 text-slate-400"
              >
                <X className="size-3.5" />
              </button>
            )}
            <SpeechButton
              size="sm"
              onTranscription={(text) => onChange(value + (value ? ' ' : '') + text)}
            />
          </div>

          <button
            type="button"
            aria-label="创建课堂主行动"
            onClick={onSubmit}
            disabled={!value.trim() || isSubmitting}
            data-testid="mobile-create-classroom-action"
            className={`mobile-tactile-button group flex min-h-[52px] w-full items-center gap-3 rounded-[16px] border px-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] active:scale-[0.99] ${
              value.trim() && !isSubmitting
                ? 'border-violet-200/18 bg-[#0d1728] text-white'
                : 'border-white/8 bg-[#0d1728]/70 text-slate-500'
            }`}
          >
            <span
              className={`mobile-tool-token flex size-9 shrink-0 items-center justify-center rounded-[13px] ${
                value.trim() && !isSubmitting
                  ? 'bg-violet-400/18 text-violet-100 ring-1 ring-violet-200/25'
                  : 'bg-white/7 text-slate-500'
              }`}
            >
              {isSubmitting ? <ArrowUp className="size-4" /> : <Camera className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold">
                {isSubmitting ? '正在提交课堂任务' : '创建互动课堂'}
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-semibold text-slate-400">
                根据输入准备课堂流程
              </span>
            </span>
            <span
              className={`flex h-8 shrink-0 items-center gap-1 rounded-[12px] px-2 text-[12px] font-extrabold ${
                value.trim() && !isSubmitting
                  ? 'bg-violet-500/18 text-violet-100'
                  : 'bg-white/5 text-slate-500'
              }`}
            >
              开始
              <ArrowRight className="size-3.5" />
            </span>
          </button>
        </div>
      </div>

      {templatePanelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pb-4 sm:items-center">
          <div className="w-full max-w-[360px] rounded-[22px] border border-white/10 bg-[#142236] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-white">选择课堂模板</h3>
              <button
                type="button"
                onClick={() => setTemplatePanelOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-white/6 text-slate-300"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {mobileTemplates.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  onClick={() => {
                    onChange(template.prompt);
                    setTemplatePanelOpen(false);
                    toast.success('已填入模板内容');
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/7 p-3 text-left active:bg-white/12"
                >
                  <span className="block text-[13px] font-semibold text-white">
                    {template.title}
                  </span>
                  <span className="mt-1 block text-[12px] text-slate-400">{template.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function MobileSkyHomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const [requirement, setRequirement] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('default-1');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([
    'default-3',
    'default-4',
    'default-5',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    todayStudyMinutes: 0,
    streakDays: 0,
    masteryPercent: 0,
  });

  useEffect(() => {
    syncMistakesFromQuizzes();
  }, []);

  useEffect(() => {
    try {
      setRequirement(localStorage.getItem('mobileRequirementDraft') ?? '');
      setWebSearch(localStorage.getItem('webSearchEnabled') === 'true');
      setInteractiveMode(localStorage.getItem('interactiveModeEnabled') === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/sky/learning-stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStats(j);
      })
      .catch(() => {});
  }, [user]);

  const handleRequirementChange = (value: string) => {
    setRequirement(value);
    try {
      localStorage.setItem('mobileRequirementDraft', value);
    } catch {
      /* ignore */
    }
  };

  const handleWebSearchChange = (enabled: boolean) => {
    setWebSearch(enabled);
    try {
      localStorage.setItem('webSearchEnabled', String(enabled));
    } catch {
      /* ignore */
    }
  };

  const handleInteractiveModeChange = (enabled: boolean) => {
    setInteractiveMode(enabled);
    try {
      localStorage.setItem('interactiveModeEnabled', String(enabled));
    } catch {
      /* ignore */
    }
  };

  const handleCreateClassroom = async () => {
    const trimmedRequirement = requirement.trim();
    if (!trimmedRequirement) {
      toast.error('请输入课堂内容');
      return;
    }

    setIsSubmitting(true);
    try {
      useSettingsStore.getState().setSelectedAgentIds([selectedTeacherId, ...selectedStudentIds]);
      const settings = useSettingsStore.getState();
      const modelString =
        settings.providerId && settings.modelId
          ? `${settings.providerId}:${settings.modelId}`
          : settings.modelId || undefined;
      const body: Record<string, unknown> = {
        requirement: trimmedRequirement,
        enableWebSearch: webSearch,
        agentMode: 'default',
        modelString,
      };

      if (pdfFile) {
        const pdfStorageKey = await storePdfBlob(pdfFile);
        body.pdfContent = { storageKey: pdfStorageKey, fileName: pdfFile.name };
      }

      const jobId = await submitClassroomJob(body);
      const topic =
        trimmedRequirement.length > 40
          ? `${trimmedRequirement.slice(0, 37)}...`
          : trimmedRequirement;

      addActiveJobEntry({ jobId, topic });
      useTaskStore.getState().addTask({
        id: jobId,
        type: 'slides',
        label: `课堂: ${topic}`,
        status: 'running',
        progress: 0,
        phase: '正在提交...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resultRoute: `/m/generation-progress?jobId=${jobId}`,
        jobId,
      });

      try {
        localStorage.removeItem('mobileRequirementDraft');
      } catch {
        /* ignore */
      }
      setRequirement('');
      setPdfFile(null);
      toast.success('课堂任务已提交');
      router.push(`/m/generation-progress?jobId=${jobId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建课堂失败，请重试';
      if (message === 'User not found' || message.includes('Not authenticated')) {
        toast.error('登录已过期，请重新登录');
        router.push('/m/auth/login?redirect=%2Fm%2Fsky');
        return;
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const compactStats = [
    {
      label: '今日',
      value: `${Math.round(stats.todayStudyMinutes)}m`,
      icon: Zap,
      iconClass: 'bg-amber-400/12 text-amber-300',
    },
    {
      label: '打卡',
      value: stats.streakDays > 0 ? `${stats.streakDays}` : '-',
      icon: CalendarCheck,
      iconClass: 'bg-pink-400/12 text-pink-300',
    },
    {
      label: '掌握',
      value: stats.masteryPercent > 0 ? `${stats.masteryPercent}%` : '-',
      icon: BookOpenCheck,
      iconClass: 'bg-emerald-400/12 text-emerald-300',
    },
  ];

  return (
    <MobileSkyShell fullBleed>
      <div className="relative flex flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-sky-600/30 via-indigo-600/15 to-transparent" />

        <section
          data-testid="mobile-home-greeting"
          aria-label="移动端首页问候与主题设置"
          className="relative px-5 pb-6 pt-9"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="text-[12px] font-semibold tracking-[0.2em] text-white/90">
              今日问候
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-[32px] font-extrabold leading-none text-white">{greeting}</h1>
              <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-white/80">
                今天先从最重要的一步开始，让学习更有方向。
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <MobileThemeControl variant="toggle" />
              <div className="grid w-[140px] grid-cols-3 gap-1.5">
                <span className="sr-only">学习数据</span>
                {compactStats.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex h-[38px] flex-col items-center justify-center rounded-[11px] border border-white/10 bg-[#0d1728]/72 px-1 py-0.5 text-center shadow-sm shadow-black/10 backdrop-blur"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span
                          className={`flex size-[14px] shrink-0 items-center justify-center rounded-full ${item.iconClass}`}
                        >
                          <Icon className="size-[8px]" />
                        </span>
                        <span className="text-[12px] font-bold leading-none text-white">
                          {item.value}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] leading-none text-slate-300/80">
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="relative space-y-4 px-4 pb-24">
          <MobileCloudMindSection />

          <MobileSkyTeachingSection>
            <MobileCreateClassroomCard
              value={requirement}
              onChange={handleRequirementChange}
              onSubmit={handleCreateClassroom}
              pdfFile={pdfFile}
              onPdfChange={setPdfFile}
              webSearch={webSearch}
              onWebSearchChange={handleWebSearchChange}
              interactiveMode={interactiveMode}
              onInteractiveModeChange={handleInteractiveModeChange}
              selectedTeacherId={selectedTeacherId}
              selectedStudentIds={selectedStudentIds}
              onTeacherChange={setSelectedTeacherId}
              onStudentsChange={setSelectedStudentIds}
              isSubmitting={isSubmitting}
            />
          </MobileSkyTeachingSection>

          <MobileStudyCompanionSection />
        </div>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
