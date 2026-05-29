'use client';

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Wrench, Zap, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { EditingModel } from '@/lib/types/settings';
import type { ProviderId } from '@/lib/ai/providers';
import { cn } from '@/lib/utils';
import { createVerifyModelRequest } from './utils';

interface ModelEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingModel: EditingModel | null;
  setEditingModel: (model: EditingModel | null) => void;
  onSave: () => void;
  onAutoSave?: () => void; // Auto-save on blur
  providerId: ProviderId;
  apiKey: string;
  baseUrl?: string;
  providerType?: string;
  requiresApiKey?: boolean;
  isServerConfigured?: boolean;
}

export function ModelEditDialog({
  open,
  onOpenChange,
  editingModel,
  setEditingModel,
  onSave,
  onAutoSave,
  providerId,
  apiKey,
  baseUrl,
  providerType,
  requiresApiKey,
  isServerConfigured,
}: ModelEditDialogProps) {const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Reset test status when dialog closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset state when dialog closes
      setTestStatus('idle');

      setTestMessage('');
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
    setEditingModel(null);
  };

  const handleTestModel = useCallback(async () => {
    if (!editingModel) {
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch('/api/verify-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          createVerifyModelRequest({
            providerId,
            modelId: editingModel.model.id,
            apiKey,
            baseUrl,
            providerType,
            requiresApiKey,
          }),
        ),
      });

      const data = await response.json();

      if (data.success) {
        setTestStatus('success');
        setTestMessage('连接成功');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || '连接失败');
      }
    } catch (_error) {
      setTestStatus('error');
      setTestMessage('连接失败');
    }
  }, [editingModel, apiKey, baseUrl, providerId, providerType, requiresApiKey]);

  if (!editingModel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogTitle className="sr-only">
          {editingModel.modelIndex === null ? '新建模型' : '编辑模型'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {editingModel.modelIndex === null
            ? '添加新的模型配置'
            : '编辑模型配置和能力'}
        </DialogDescription>
        <div className="space-y-4">
          <div className="pb-3 border-b">
            <h2 className="text-lg font-semibold">
              {editingModel.modelIndex === null
                ? '新建模型'
                : '编辑模型'}
            </h2>
          </div>

          {/* Model ID */}
          <div className="space-y-2">
            <Label>{'模型ID'}</Label>
            <Input
              placeholder={'例如：gpt-4o'}
              value={editingModel.model.id}
              onChange={(e) => {
                const newId = e.target.value;
                const currentName = editingModel.model.name;
                const currentId = editingModel.model.id;

                // Auto-sync name if it's empty or matches the old ID
                const shouldSyncName = !currentName || currentName === currentId;

                setEditingModel({
                  ...editingModel,
                  model: {
                    ...editingModel.model,
                    id: newId,
                    name: shouldSyncName ? newId : currentName,
                  },
                });

                // Reset test status when model ID changes
                setTestStatus('idle');
                setTestMessage('');
              }}
              onBlur={() => onAutoSave?.()}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label>{'显示名称'}</Label>
            <Input
              placeholder={'可选'}
              value={editingModel.model.name}
              onChange={(e) =>
                setEditingModel({
                  ...editingModel,
                  model: { ...editingModel.model, name: e.target.value },
                })
              }
              onBlur={() => onAutoSave?.()}
            />
          </div>

          {/* Capabilities */}
          <div className="space-y-2">
            <Label>{'能力'}</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cap-vision"
                  checked={editingModel.model.capabilities?.vision || false}
                  onCheckedChange={(checked) => {
                    setEditingModel({
                      ...editingModel,
                      model: {
                        ...editingModel.model,
                        capabilities: {
                          ...editingModel.model.capabilities,
                          vision: checked as boolean,
                        },
                      },
                    });
                    onAutoSave?.();
                  }}
                />
                <label
                  htmlFor="cap-vision"
                  className="text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {'视觉'}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cap-tools"
                  checked={editingModel.model.capabilities?.tools || false}
                  onCheckedChange={(checked) => {
                    setEditingModel({
                      ...editingModel,
                      model: {
                        ...editingModel.model,
                        capabilities: {
                          ...editingModel.model.capabilities,
                          tools: checked as boolean,
                        },
                      },
                    });
                    onAutoSave?.();
                  }}
                />
                <label
                  htmlFor="cap-tools"
                  className="text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {'工具'}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cap-streaming"
                  checked={editingModel.model.capabilities?.streaming || false}
                  onCheckedChange={(checked) => {
                    setEditingModel({
                      ...editingModel,
                      model: {
                        ...editingModel.model,
                        capabilities: {
                          ...editingModel.model.capabilities,
                          streaming: checked as boolean,
                        },
                      },
                    });
                    onAutoSave?.();
                  }}
                />
                <label
                  htmlFor="cap-streaming"
                  className="text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {'流式'}
                </label>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3 pt-3 border-t">
            <Label className="text-base">{'高级设置'}</Label>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{'上下文窗口'}</Label>
                <Input
                  type="number"
                  placeholder={'例如 128000'}
                  value={editingModel.model.contextWindow || ''}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      model: {
                        ...editingModel.model,
                        contextWindow: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                  onBlur={() => onAutoSave?.()}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{'最大输出Token数'}</Label>
                <Input
                  type="number"
                  placeholder={'例如 4096'}
                  value={editingModel.model.outputWindow || ''}
                  onChange={(e) =>
                    setEditingModel({
                      ...editingModel,
                      model: {
                        ...editingModel.model,
                        outputWindow: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                  onBlur={() => onAutoSave?.()}
                />
              </div>
            </div>
          </div>

          {/* Test Model */}
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base">{'测试模型'}</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestModel}
                disabled={
                  !editingModel.model.id ||
                  testStatus === 'testing' ||
                  (requiresApiKey && !apiKey && !isServerConfigured)
                }
                className={cn(
                  testStatus === 'success' && 'border-green-600 text-green-600 hover:bg-green-50',
                  testStatus === 'error' && 'border-red-600 text-red-600 hover:bg-red-50',
                )}
              >
                {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {testStatus === 'success' && <CheckCircle className="mr-2 h-4 w-4" />}
                {testStatus === 'error' && <XCircle className="mr-2 h-4 w-4" />}
                {testStatus === 'testing' ? '测试中...' : '测试连接'}
              </Button>
            </div>
            {testMessage && (
              <div
                className={cn(
                  'rounded-lg p-3 text-sm',
                  testStatus === 'success' && 'bg-green-50 text-green-700 border border-green-200',
                  testStatus === 'error' && 'bg-red-50 text-red-700 border border-red-200',
                )}
              >
                <div className="flex items-start gap-2 flex-wrap">
                  {testStatus === 'success' && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  {testStatus === 'error' && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <p className="flex-1 break-words">{testMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={handleClose}>
              {'取消'}
            </Button>
            <Button size="sm" onClick={onSave}>
              {'保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
