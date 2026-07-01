import { BookOpenCheck, Database, FileSearch, Network } from 'lucide-react';
import { PanelShell } from './panel-shell';

const COURSE_MODULES = [
  {
    title: '课程大纲',
    detail: '覆盖人工智能概念、搜索、机器学习、神经网络与应用案例。',
    icon: BookOpenCheck,
  },
  {
    title: '章节知识点',
    detail: '移动端先展示摘要与关键节点，复杂知识图谱交互后续接入。',
    icon: Network,
  },
  {
    title: '资源检索',
    detail: '等待课程 RAG 索引接入后展示真实引用与章节来源。',
    icon: FileSearch,
  },
];

export function CourseKnowledgePanel() {
  return (
    <PanelShell icon={Database} title="课程知识库" eyebrow="AI Introduction">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-cyan-100/10 dark:bg-white/[0.04]">
        <div className="text-sm font-semibold text-slate-950 dark:text-white">《人工智能导论》</div>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          作为比赛主线课程知识库入口。当前展示课程演示配置；真实 RAG
          检索、来源引用和事实核验结果会在生成链路接入后显示。
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {COURSE_MODULES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="min-h-[116px] rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-cyan-100/10 dark:bg-[#0b1729] dark:shadow-none"
            >
              <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-100" />
              <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {item.title}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
