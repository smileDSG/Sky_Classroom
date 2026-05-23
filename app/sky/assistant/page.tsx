'use client';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { AssistantPanel } from '@/components/sky/assistant/assistant-panel';
import { AssistantConfig } from '@/components/sky/assistant/assistant-config';
import { useI18n } from '@/lib/hooks/use-i18n';

export default function AssistantPage() {
  const { t } = useI18n();

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">💡 {t('sky.assistant.title')}</h2>
        <AssistantConfig />
        <AssistantPanel />
      </div>
    </SkyAppShell>
  );
}
