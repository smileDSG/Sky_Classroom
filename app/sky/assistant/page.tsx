'use client';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { AssistantPanel } from '@/components/sky/assistant/assistant-panel';
import { AssistantConfig } from '@/components/sky/assistant/assistant-config';

export default function AssistantPage() {
  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl h-full flex flex-col overflow-hidden gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 shrink-0">AI 助手</h2>
        <div className="shrink-0">
          <AssistantConfig />
        </div>
        <AssistantPanel />
      </div>
    </SkyAppShell>
  );
}
