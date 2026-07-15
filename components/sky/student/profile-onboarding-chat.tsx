'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { ConversationalProfilePatch } from '@/lib/student/conversation-profile';

interface ConversationResponse {
  success?: boolean;
  data?: {
    nextQuestion?: string;
    profilePatch?: ConversationalProfilePatch;
    evidence?: string[];
    needsConfirmation?: boolean;
  };
  error?: string;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface ProfileSuggestionPrompt {
  label: string;
  text: string;
}

interface ProfileOnboardingChatProps {
  title?: string;
  description?: string;
  starterQuestion?: string;
  placeholder?: string;
  submitLabel?: string;
  suggestionPrompts?: ProfileSuggestionPrompt[];
  onPatchChange?: (patch: ConversationalProfilePatch) => void;
}

const STARTER_QUESTION = '你最近最想提升哪门课或哪个能力？也可以直接说当前最卡的知识点。';
const DEFAULT_TITLE = '对话式学习画像';
const DEFAULT_DESCRIPTION = '聊 2 分钟，我会把目标、薄弱点和讲解偏好转成后续推荐依据。';
const DEFAULT_PLACEHOLDER =
  '例如：我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。';
const DEFAULT_SUBMIT_LABEL = '发送';

function summarizePatch(patch?: ConversationalProfilePatch): string[] {
  if (!patch) return [];

  const rows: string[] = [];
  if (patch.learningGoal?.value) rows.push(`目标：${patch.learningGoal.value}`);
  if (patch.majorBackground?.value) rows.push(`背景：${patch.majorBackground.value}`);
  if (patch.knowledgeBase?.weakPoints.length) {
    rows.push(`薄弱点：${patch.knowledgeBase.weakPoints.join('、')}`);
  }
  if (patch.resourcePreference?.value.length) {
    rows.push(`资源偏好：${patch.resourcePreference.value.join('、')}`);
  }
  if (patch.interactionPreference?.value) {
    rows.push(`讲解偏好：${patch.interactionPreference.value}`);
  }
  if (patch.learningPace?.value) rows.push(`节奏：${patch.learningPace.value}`);
  if (patch.currentLearningState?.value) rows.push(`当前状态：${patch.currentLearningState.value}`);
  return rows;
}

export function ProfileOnboardingChat({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  starterQuestion = STARTER_QUESTION,
  placeholder = DEFAULT_PLACEHOLDER,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  suggestionPrompts = [],
  onPatchChange,
}: ProfileOnboardingChatProps) {
  const [sessionId] = useState(() => `profile-onboarding-${Date.now()}`);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: starterQuestion },
  ]);
  const [patch, setPatch] = useState<ConversationalProfilePatch>();
  const [evidence, setEvidence] = useState<string[]>([]);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchRows = useMemo(() => summarizePatch(patch), [patch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setInput('');
    setError(null);
    setLoading(true);
    setMessages((current) => [...current, { role: 'user', content: message }]);

    try {
      const response = await fetch('/api/sky/student/profile/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          stage: messages.length <= 1 ? 'onboarding' : 'learning',
        }),
      });
      const json = (await response.json()) as ConversationResponse;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error || '画像对话更新失败');
      }

      setPatch(json.data.profilePatch);
      if (json.data.profilePatch) {
        onPatchChange?.(json.data.profilePatch);
      }
      setEvidence(json.data.evidence ?? []);
      setNeedsConfirmation(Boolean(json.data.needsConfirmation));
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: json.data?.nextQuestion || starterQuestion,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像对话更新失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6 border-sky-200/70 bg-white/75 shadow-sm backdrop-blur-sm dark:border-sky-400/20 dark:bg-slate-900/70">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === 'user'
                  ? 'ml-auto max-w-[88%] rounded-2xl bg-sky-600 px-3.5 py-2.5 text-sm leading-6 text-white'
                  : 'max-w-[88%] rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }
            >
              {message.content}
            </div>
          ))}
        </div>

        {patchRows.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-50">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              当前抽取结果
            </div>
            <div className="space-y-1.5">
              {patchRows.map((row) => (
                <div key={row}>{row}</div>
              ))}
            </div>
            {evidence.length > 0 && (
              <div className="mt-2 text-xs leading-5 opacity-80">
                依据：{evidence.slice(0, 6).join('、')}
              </div>
            )}
            {needsConfirmation && (
              <div className="mt-2 text-xs leading-5 opacity-80">
                回复“对”或直接修正，我会按你的确认继续调整。
              </div>
            )}
          </div>
        )}

        {suggestionPrompts.length > 0 && (
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-3 dark:border-sky-300/20 dark:bg-sky-300/10">
            <div className="mb-2 text-xs font-semibold text-sky-700 dark:text-sky-100">
              参考建议
            </div>
            <div className="grid gap-2">
              {suggestionPrompts.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  aria-label={prompt.label}
                  onClick={() => {
                    setInput(prompt.text);
                    setError(null);
                  }}
                  className="min-h-11 rounded-xl border border-sky-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-sky-300/20 dark:bg-slate-950/35 dark:hover:bg-sky-300/10"
                >
                  <span className="block font-semibold text-sky-800 dark:text-sky-100">
                    {prompt.label}
                  </span>
                  <span className="mt-1 block leading-5 text-slate-600 dark:text-slate-300">
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            className="min-h-20 flex-1 resize-none"
          />
          <Button type="submit" disabled={loading || input.trim().length === 0} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitLabel}
          </Button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
