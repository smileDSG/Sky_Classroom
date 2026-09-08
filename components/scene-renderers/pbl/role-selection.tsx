'use client';

import type { PBLAgent, PBLProjectInfo } from '@/lib/pbl/types';
import { PBLGuideInline } from './guide';

interface PBLRoleSelectionProps {
  readonly projectInfo: PBLProjectInfo;
  readonly agents: PBLAgent[];
  readonly onSelectRole: (agentName: string) => void;
}

export function PBLRoleSelection({ projectInfo, agents, onSelectRole }: PBLRoleSelectionProps) {
  const selectableAgents = agents.filter(
    (agent) => !agent.is_system_agent && agent.role_division === 'development',
  );

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-white p-4 dark:bg-slate-950 sm:p-8">
      <div className="relative flex min-h-0 w-full max-w-[900px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-[0_18px_55px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950 sm:min-h-[520px] sm:px-16 sm:py-12">
        <div className="pointer-events-none absolute right-4 top-4 flex gap-2 opacity-60 sm:right-7 sm:top-7">
          <span className="h-4 w-4 rounded-full bg-slate-100 dark:bg-slate-800" />
          <span className="h-4 w-4 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>

        <h1 className="max-w-3xl text-balance text-2xl font-extrabold leading-tight tracking-tight text-slate-950 dark:text-slate-50 sm:text-[32px]">
          {projectInfo.title}
        </h1>
        <p className="mt-4 max-w-2xl text-balance text-base leading-7 text-slate-600 dark:text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
          {projectInfo.description}
        </p>

        <div className="mt-8 w-full max-w-[680px] sm:mt-12">
          <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50 sm:text-2xl">
            选择你的角色
          </h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 sm:mt-4">
            选择一个角色开始协作项目
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-5">
            {selectableAgents.map((agent) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => onSelectRole(agent.name)}
                className="group flex min-h-[4.5rem] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-700 dark:hover:shadow-violet-950/30 sm:min-h-20 sm:gap-4 sm:px-7 sm:py-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700 transition-colors group-hover:bg-violet-600 group-hover:text-white dark:bg-violet-950 dark:text-violet-300">
                  {agent.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-slate-950 dark:text-slate-50">
                    {agent.name}
                  </span>
                  {agent.actor_role && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {agent.actor_role}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 sm:mt-10">
          <PBLGuideInline />
        </div>
      </div>
    </div>
  );
}
