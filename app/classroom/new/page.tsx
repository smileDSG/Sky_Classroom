'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HeroInput } from '@/components/sky/home/hero-input';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { useSettingsStore } from '@/lib/store/settings';
import { resolveChatModelSelection } from '@/lib/utils/model-config';
import type { ProviderId } from '@/lib/ai/providers';
import { storePdfBlob } from '@/lib/utils/image-storage';
import { submitClassroomJob } from '@/lib/classroom/classroom-job-client';
import { addActiveJobEntry } from '@/lib/classroom/classroom-session';

export default function NewClassroomPage() {
  const router = useRouter();
  const [requirement, setRequirement] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [teacherId, setTeacherId] = useState('default-1');
  const [studentIds, setStudentIds] = useState<string[]>(['default-3', 'default-4', 'default-5']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!requirement.trim()) {
      setError('请输入课程内容或想学习的知识点');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      useSettingsStore.getState().setSelectedAgentIds([teacherId, ...studentIds]);
      const settings = useSettingsStore.getState();
      const selection = resolveChatModelSelection(
        (settings.providerId || 'openai') as ProviderId,
        settings.modelId || 'gpt-5.5',
      );
      const modelString = `${selection.providerId}:${selection.modelId}`;
      const body: Record<string, unknown> = {
        requirement,
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
        requirement.trim().length > 40
          ? `${requirement.trim().slice(0, 37)}...`
          : requirement.trim();
      addActiveJobEntry({ jobId, topic });
      router.push(`/generation-progress?jobId=${jobId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成讲解失败，请重试';
      if (msg === 'User not found' || msg.includes('Not authenticated')) {
        toast.error('登录已过期，请重新登录');
        router.push('/auth/login');
        return;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            生成互动课堂
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            输入知识点，AI 老师 + 同学即刻开讲
          </p>
        </header>
        <HeroInput
          value={requirement}
          onChange={setRequirement}
          onSubmit={handleGenerate}
          onTemplateClick={() => {}} // 模板/设置面板暂不接，入口页保持最小
          pdfFile={pdfFile}
          onPdfChange={setPdfFile}
          interactiveMode={interactiveMode}
          onInteractiveModeChange={setInteractiveMode}
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
          canSubmit={!!requirement.trim() && !submitting}
          onSettingsOpen={() => {}} // 同上：设置面板保留在完整生成中枢内
          selectedTeacherId={teacherId}
          selectedStudentIds={studentIds}
          onTeacherChange={setTeacherId}
          onStudentsChange={setStudentIds}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </SkyAppShell>
  );
}
