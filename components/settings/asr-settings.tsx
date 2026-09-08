'use client';

import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsStore } from '@/lib/store/settings';
import { ASR_PROVIDERS } from '@/lib/audio/constants';
import type { ASRProviderId } from '@/lib/audio/types';
import { isCustomASRProvider } from '@/lib/audio/types';
import { Mic, MicOff, CheckCircle2, XCircle, Eye, EyeOff, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { normalizeASRUploadAudio } from '@/lib/audio/wav-utils';

const log = createLogger('ASRSettings');

interface ASRSettingsProps {
  selectedProviderId: ASRProviderId;
}

export function ASRSettings({ selectedProviderId }: ASRSettingsProps) {
  const asrLanguage = useSettingsStore((state) => state.asrLanguage);
  const asrProvidersConfig = useSettingsStore((state) => state.asrProvidersConfig);
  const setASRProviderConfig = useSettingsStore((state) => state.setASRProviderConfig);
  const removeCustomASRProvider = useSettingsStore((state) => state.removeCustomASRProvider);

  const asrProvider = ASR_PROVIDERS[selectedProviderId as keyof typeof ASR_PROVIDERS];
  const isCustom = isCustomASRProvider(selectedProviderId);
  const providerConfig = asrProvidersConfig[selectedProviderId];
  const isServerConfigured = !!providerConfig?.isServerConfigured;
  const requiresApiKey = isCustom
    ? !!providerConfig?.requiresApiKey
    : !!asrProvider?.requiresApiKey;
  const isKeylessLocalProvider = !isCustom && !requiresApiKey && !!asrProvider?.defaultBaseUrl;

  const [showApiKey, setShowApiKey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [asrResult, setASRResult] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Reset state when provider changes (derived state pattern)
  const [prevProviderId, setPrevProviderId] = useState(selectedProviderId);
  if (selectedProviderId !== prevProviderId) {
    setPrevProviderId(selectedProviderId);
    setShowApiKey(false);
    setTestStatus('idle');
    setTestMessage('');
    setASRResult('');
  }

  const handleToggleASRRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      setASRResult('');
      setTestStatus('testing');
      setTestMessage('');

      if (selectedProviderId === 'browser-native') {
        const SpeechRecognitionCtor =
          (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
          setTestStatus('error');
          setTestMessage('浏览器不支持语音识别 API');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vendor-prefixed API without standard typings
        const recognition = new (SpeechRecognitionCtor as new () => any)();
        recognition.lang = asrLanguage || 'zh-CN';
        recognition.onresult = (event: {
          results: {
            [index: number]: { [index: number]: { transcript: string } };
          };
        }) => {
          const transcript = event.results[0][0].transcript;
          setASRResult(transcript);
          setTestStatus('success');
          setTestMessage('语音识别成功');
        };
        recognition.onerror = (event: { error: string }) => {
          setTestStatus('error');
          setTestMessage('语音识别失败' + ': ' + event.error);
        };
        recognition.onend = () => {
          setIsRecording(false);
        };
        recognition.start();
        setIsRecording(true);
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          const audioChunks: Blob[] = [];
          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };
          mediaRecorder.onstop = async () => {
            stream.getTracks().forEach((track) => track.stop());
            setIsProcessing(true);

            try {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              const uploadAudio = await normalizeASRUploadAudio(selectedProviderId, audioBlob);
              const formData = new FormData();
              formData.append('audio', uploadAudio.blob, uploadAudio.fileName);
              formData.append('providerId', selectedProviderId);
              formData.append(
                'modelId',
                asrProvidersConfig[selectedProviderId]?.modelId ||
                  asrProvider?.defaultModelId ||
                  '',
              );
              formData.append('language', asrLanguage);
              const apiKeyValue = asrProvidersConfig[selectedProviderId]?.apiKey;
              if (apiKeyValue?.trim()) formData.append('apiKey', apiKeyValue);
              const baseUrlValue =
                asrProvidersConfig[selectedProviderId]?.baseUrl ||
                providerConfig?.customDefaultBaseUrl ||
                '';
              if (baseUrlValue?.trim()) formData.append('baseUrl', baseUrlValue);

              const response = await fetch('/api/transcription', {
                method: 'POST',
                body: formData,
              });
              if (response.ok) {
                const data = await response.json();
                if (data.text?.trim()) {
                  setASRResult(data.text);
                  setTestStatus('success');
                  setTestMessage('语音识别成功');
                } else {
                  setTestStatus('error');
                  setTestMessage(data.error || '未生成转写结果，请尝试说大声一些或说长一些。');
                }
              } else {
                setTestStatus('error');
                const errorData = await response
                  .json()
                  .catch(() => ({ error: response.statusText }));
                setTestMessage(errorData.details || errorData.error || '语音识别失败');
              }
            } catch (error) {
              log.error('ASR test failed:', error);
              setTestStatus('error');
              setTestMessage(
                error instanceof Error && error.message
                  ? `${'语音识别失败'}: ${error.message}`
                  : '语音识别失败',
              );
            } finally {
              setIsProcessing(false);
            }
          };
          mediaRecorder.start();
          setIsRecording(true);
        } catch (error) {
          log.error('Failed to access microphone:', error);
          setTestStatus('error');
          setTestMessage('无法访问麦克风');
        }
      }
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Server-configured notice */}
      {isServerConfigured && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
          {'管理员已在服务端配置了此提供方的 API Key，可直接使用。也可输入自己的 Key 覆盖。'}
        </div>
      )}

      {/* No models warning for custom providers */}
      {isCustom && ((providerConfig?.customModels as Array<{ id: string }>) || []).length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          {'请先在下方添加至少一个模型，才能使用此服务。'}
        </div>
      )}

      {/* API Key & Base URL */}
      {(requiresApiKey || isServerConfigured || isCustom || isKeylessLocalProvider) && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">{'API 密钥'}</Label>
              <div className="relative">
                <Input
                  name={`asr-api-key-${selectedProviderId}`}
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={isServerConfigured ? '可选，留空则使用服务端配置' : '输入 API Key'}
                  value={asrProvidersConfig[selectedProviderId]?.apiKey || ''}
                  onChange={(e) =>
                    setASRProviderConfig(selectedProviderId, {
                      apiKey: e.target.value,
                    })
                  }
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{'Base URL'}</Label>
              <Input
                name={`asr-base-url-${selectedProviderId}`}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={
                  isCustom
                    ? providerConfig?.customDefaultBaseUrl || 'http://localhost:8000/v1'
                    : asrProvider?.defaultBaseUrl || '输入自定义 Base URL'
                }
                value={asrProvidersConfig[selectedProviderId]?.baseUrl || ''}
                onChange={(e) =>
                  setASRProviderConfig(selectedProviderId, {
                    baseUrl: e.target.value,
                  })
                }
                className="text-sm"
              />
            </div>
          </div>
          {/* Request URL Preview */}
          {(() => {
            const effectiveBaseUrl =
              asrProvidersConfig[selectedProviderId]?.baseUrl ||
              (isCustom ? providerConfig?.customDefaultBaseUrl : asrProvider?.defaultBaseUrl) ||
              '';
            if (!effectiveBaseUrl) return null;
            let endpointPath = '';
            if (isCustom) {
              endpointPath = '/audio/transcriptions';
            } else {
              switch (selectedProviderId) {
                case 'openai-whisper':
                case 'lemonade-asr':
                  endpointPath = '/audio/transcriptions';
                  break;
                case 'qwen-asr':
                  endpointPath = '/services/aigc/multimodal-generation/generation';
                  break;
              }
            }
            if (!endpointPath) return null;
            return (
              <p className="text-xs text-muted-foreground break-all">
                {'请求地址'}: {effectiveBaseUrl + endpointPath}
              </p>
            );
          })()}
        </>
      )}

      {/* Test ASR */}
      <div className="space-y-2">
        <Label className="text-sm">{'测试 ASR'}</Label>
        <div className="flex gap-2">
          <Input
            value={asrResult}
            readOnly
            placeholder={'录音后将显示识别结果'}
            className="flex-1 bg-muted/50"
          />
          <Button
            onClick={handleToggleASRRecording}
            disabled={
              isProcessing ||
              (requiresApiKey &&
                !asrProvidersConfig[selectedProviderId]?.apiKey?.trim() &&
                !isServerConfigured)
            }
            className="gap-2 w-[140px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {'处理中...'}
              </>
            ) : isRecording ? (
              <>
                <MicOff className="h-4 w-4" />
                {'停止录音'}
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                {'开始录音'}
              </>
            )}
          </Button>
        </div>
      </div>

      {testMessage && (
        <div
          className={cn(
            'rounded-lg p-3 text-sm overflow-hidden',
            testStatus === 'success' &&
              'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
            testStatus === 'error' &&
              'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            {testStatus === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
            {testStatus === 'error' && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <p className="flex-1 min-w-0 break-all">{testMessage}</p>
          </div>
        </div>
      )}

      {/* Model Selection — built-in providers */}
      {!isCustom && asrProvider?.models?.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">{'默认模型'}</Label>
          <Select
            value={asrProvidersConfig[selectedProviderId]?.modelId || asrProvider?.defaultModelId}
            onValueChange={(value) => setASRProviderConfig(selectedProviderId, { modelId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {asrProvider?.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Model Management — custom providers */}
      {isCustom && (
        <div className="space-y-3">
          <Label className="text-sm">{'可用模型'}</Label>
          {(() => {
            const customModels =
              (providerConfig?.customModels as Array<{ id: string; name: string }>) || [];
            const activeModelId =
              asrProvidersConfig[selectedProviderId]?.modelId || customModels[0]?.id || '';
            return (
              <>
                {customModels.length > 0 ? (
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="grid grid-cols-[20px_1fr_1fr_36px] gap-0 bg-muted/40 px-3 py-1.5 border-b border-border/40">
                      <span />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        ID
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {'可选'}
                      </span>
                      <span />
                    </div>
                    {customModels.map((model, index) => {
                      const isActive = model.id === activeModelId;
                      return (
                        <div
                          key={model.id}
                          onClick={() =>
                            setASRProviderConfig(selectedProviderId, { modelId: model.id })
                          }
                          className={cn(
                            'grid grid-cols-[20px_1fr_1fr_36px] gap-0 items-center px-3 py-2 group cursor-pointer transition-colors',
                            isActive ? 'bg-primary/5' : 'hover:bg-muted/20',
                            index > 0 && 'border-t border-border/30',
                          )}
                        >
                          <div className="flex items-center -ml-1">
                            <div
                              className={cn(
                                'size-4 rounded-full border-2 flex items-center justify-center transition-colors',
                                isActive
                                  ? 'border-primary'
                                  : 'border-muted-foreground/30 group-hover:border-muted-foreground/50',
                              )}
                            >
                              {isActive && <div className="size-2 rounded-full bg-primary" />}
                            </div>
                          </div>
                          <span className="text-sm font-mono text-foreground/80 truncate pr-3">
                            {model.id}
                          </span>
                          <span className="text-sm text-foreground/60 truncate pr-3">
                            {model.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              const models = [...customModels];
                              models.splice(index, 1);
                              const newModelId = isActive ? models[0]?.id || '' : activeModelId;
                              setASRProviderConfig(selectedProviderId, {
                                customModels: models,
                                modelId: newModelId,
                              });
                            }}
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    {'暂无模型，请在下方添加以支持模型选择。'}
                  </p>
                )}
                <AddModelRow
                  existingIds={customModels.map((m) => m.id)}
                  onAdd={(modelId, modelName) => {
                    const models = [...customModels, { id: modelId, name: modelName }];
                    setASRProviderConfig(selectedProviderId, {
                      customModels: models,
                      modelId: models[0].id,
                    });
                  }}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* Delete Custom Provider */}
      {isCustom && (
        <div className="pt-4 border-t">
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            {'删除提供方'}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !open && setShowDeleteConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{'删除提供方'}</AlertDialogTitle>
            <AlertDialogDescription>{'确定要删除此提供方吗？'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{'取消'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removeCustomASRProvider(selectedProviderId);
                setShowDeleteConfirm(false);
              }}
            >
              {'删除提供方'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddModelRow({
  onAdd,
  existingIds,
}: {
  onAdd: (id: string, name: string) => void;
  existingIds: string[];
}) {
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');

  const handleAdd = () => {
    if (!modelId.trim()) return;
    if (existingIds.includes(modelId.trim())) {
      toast.error('Duplicate ID');
      return;
    }
    onAdd(modelId.trim(), modelName.trim() || modelId.trim());
    setModelId('');
    setModelName('');
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
      <Input
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        className="text-sm font-mono"
        placeholder={'例如：gpt-4o'}
      />
      <Input
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        className="text-sm"
        placeholder={'可选'}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={!modelId.trim()}
        className="shrink-0 gap-1"
      >
        <Plus className="h-3.5 w-3.5" />
        {'添加'}
      </Button>
    </div>
  );
}
