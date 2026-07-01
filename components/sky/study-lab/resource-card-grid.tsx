import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Code2,
  FileQuestion,
  Map,
  Presentation,
  ScrollText,
  Video,
} from 'lucide-react';
import { PanelShell } from './panel-shell';

interface ResourceEntry {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  status: 'ready' | 'pending';
}

const RESOURCES: ResourceEntry[] = [
  {
    title: '微课讲义',
    detail: '调用智能授课生成可学习内容。',
    href: '/sky/cloud-mind/teaching',
    icon: BookOpen,
    status: 'ready',
  },
  {
    title: 'PPT 课件',
    detail: '进入课件生成工具。',
    href: '/sky/cloud-mind/slides',
    icon: Presentation,
    status: 'ready',
  },
  {
    title: '练习题库',
    detail: '按画像和知识点生成练习。',
    href: '/sky/cloud-mind/quiz',
    icon: FileQuestion,
    status: 'ready',
  },
  {
    title: '记忆卡片',
    detail: '把薄弱点转成短周期复习。',
    href: '/sky/cloud-mind/memory',
    icon: Brain,
    status: 'ready',
  },
  {
    title: '思维导图',
    detail: '先查看天梯知识图谱摘要。',
    href: '/sky/learning/graph',
    icon: Map,
    status: 'pending',
  },
  {
    title: '拓展阅读',
    detail: '等待 RAG 来源接入后生成。',
    href: '/sky/assistant?context=study-lab-reading',
    icon: ScrollText,
    status: 'pending',
  },
  {
    title: '视频脚本',
    detail: '可先由 AI 助手辅助改写。',
    href: '/sky/assistant?context=study-lab-video-script',
    icon: Video,
    status: 'pending',
  },
  {
    title: '代码案例',
    detail: '适合算法和工程实践主题。',
    href: '/sky/assistant?context=study-lab-code-case',
    icon: Code2,
    status: 'pending',
  },
];

export function ResourceCardGrid() {
  return (
    <PanelShell icon={Presentation} title="多资源生成入口" eyebrow="Resources">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <Link
              key={resource.title}
              href={resource.href}
              className="group flex min-h-[132px] flex-col justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-cyan-100/10 dark:bg-[#0b1729] dark:shadow-none dark:hover:border-emerald-200/30 dark:hover:bg-white/[0.07]"
            >
              <span>
                <span className="flex items-center justify-between gap-2">
                  <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-100" />
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-cyan-100/10 dark:text-slate-400">
                    {resource.status === 'ready' ? '已接入' : '待接入'}
                  </span>
                </span>
                <span className="mt-3 block text-sm font-semibold text-slate-950 dark:text-white">
                  {resource.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {resource.detail}
                </span>
              </span>
              <span className="mt-3 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-100">
                打开入口
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </PanelShell>
  );
}
