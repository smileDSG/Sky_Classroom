'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
export interface NewAudioProviderData {
  name: string;
  baseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
}

interface AddAudioProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: NewAudioProviderData) => void;
  type: 'tts' | 'asr';
}

export function AddAudioProviderDialog({
  open,
  onOpenChange,
  onAdd,
  type,
}: AddAudioProviderDialogProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [requiresApiKey, setRequiresApiKey] = useState(false);

  // Reset form when dialog closes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setName('');
      setBaseUrl('');
      setDefaultModel('');
      setRequiresApiKey(false);
    }
  }

  const handleAdd = () => {
    if (!name.trim() || !baseUrl.trim()) return;
    onAdd({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      defaultModel: defaultModel.trim(),
      requiresApiKey,
    });
    onOpenChange(false);
  };

  const title = type === 'tts' ? '添加自定义 TTS 服务' : '添加自定义 ASR 服务';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {'添加兼容 OpenAI 协议的音频服务'}
        </DialogDescription>
        <div className="space-y-4">
          <div className="pb-3 border-b">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{'添加兼容 OpenAI 协议的音频服务'}</p>
          </div>

          <div className="space-y-2">
            <Label>{'名称'}</Label>
            <Input
              placeholder={type === 'tts' ? 'My Local TTS' : 'My Local ASR'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{'默认 Base URL'}</Label>
            <Input
              type="url"
              placeholder="http://localhost:8000/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          {/* Default Model — TTS only (ASR models are managed in provider settings) */}
          {type === 'tts' && (
            <div className="space-y-2">
              <Label>{'默认模型'}</Label>
              <Input
                placeholder="tts-1"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {'API 请求中的模型名（如 kokoro、tts-1）'}
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="audio-requires-api-key"
              checked={requiresApiKey}
              onCheckedChange={(checked) => setRequiresApiKey(checked as boolean)}
            />
            <label htmlFor="audio-requires-api-key" className="text-sm cursor-pointer">
              {'需要 API 密钥'}
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {'取消'}
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!name.trim() || !baseUrl.trim()}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {'添加'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
