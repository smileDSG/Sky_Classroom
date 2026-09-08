'use client';

import { useMemo, useState, useCallback } from 'react';
import { Presentation, Sparkles, Wand2, Mic, ImageIcon, Video, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AgentSelector } from '@/components/sky/home/agent-selector';
import {
  recommendAgentsFromLessonPlan,
  DEFAULT_CLASSROOM_CONFIG,
  type TeachingToClassroomConfig,
} from '@/lib/teaching/classroom-config-recommendation';
import type { LessonPlan } from '@/lib/teaching/lesson-types';
import type { GeneratedSectionData } from '@/lib/server/teaching-job-store';

interface ClassroomConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: LessonPlan | null;
  sections: GeneratedSectionData[];
  onSubmit: (config: TeachingToClassroomConfig) => void | Promise<void>;
  loading: boolean;
}

export function ClassroomConfigDialog({
  open,
  onOpenChange,
  plan,
  sections,
  onSubmit,
  loading,
}: ClassroomConfigDialogProps) {
  const recommended = useMemo(
    () => recommendAgentsFromLessonPlan(plan, sections),
    [plan, sections],
  );
  const [config, setConfig] = useState<TeachingToClassroomConfig>(() => ({
    ...DEFAULT_CLASSROOM_CONFIG,
    selectedTeacherId: recommended.teacherId,
    selectedStudentIds: recommended.studentIds,
  }));
  const [isRecommended, setIsRecommended] = useState(false);

  const applyRecommendation = useCallback(() => {
    const recommended = recommendAgentsFromLessonPlan(plan, sections);
    setConfig((prev) => ({
      ...prev,
      selectedTeacherId: recommended.teacherId,
      selectedStudentIds: recommended.studentIds,
    }));
    setIsRecommended(true);
  }, [plan, sections]);

  const canSubmit = config.selectedTeacherId && config.selectedStudentIds.length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || loading) return;
    onSubmit(config);
  }, [canSubmit, config, loading, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-violet-500" />
            创建课堂
          </DialogTitle>
          <DialogDescription>
            根据已生成的教案创建沉浸式课堂，并可选择角色与多媒体能力。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Role selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  课堂角色
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isRecommended && (
                  <Badge variant="secondary" className="text-[10px]">
                    已根据教案内容推荐
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={applyRecommendation}
                  className="h-7 gap-1 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                >
                  <Wand2 className="h-3 w-3" />
                  智能推荐
                </Button>
              </div>
            </div>

            <AgentSelector
              selectedTeacherId={config.selectedTeacherId}
              selectedStudentIds={config.selectedStudentIds}
              onTeacherChange={(teacherId) =>
                setConfig((prev) => ({ ...prev, selectedTeacherId: teacherId }))
              }
              onStudentsChange={(studentIds) =>
                setConfig((prev) => ({ ...prev, selectedStudentIds: studentIds }))
              }
            />
          </div>

          {/* Media switches */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                多媒体生成
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tts" className="flex items-center gap-2 text-sm font-medium">
                    <Mic className="h-3.5 w-3.5 text-emerald-500" />
                    讲解语音
                  </Label>
                  <p className="text-xs text-slate-500">为每个场景生成 AI 讲解语音</p>
                </div>
                <Switch
                  id="tts"
                  checked={config.enableTTS}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, enableTTS: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="image" className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-3.5 w-3.5 text-sky-500" />
                    配图生成
                  </Label>
                  <p className="text-xs text-slate-500">为关键知识点自动生成配图</p>
                </div>
                <Switch
                  id="image"
                  checked={config.enableImageGeneration}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, enableImageGeneration: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="video" className="flex items-center gap-2 text-sm font-medium">
                    <Video className="h-3.5 w-3.5 text-rose-500" />
                    视频生成
                  </Label>
                  <p className="text-xs text-slate-500">生成视频片段，耗时较长且耗配额</p>
                </div>
                <Switch
                  id="video"
                  checked={config.enableVideoGeneration}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, enableVideoGeneration: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Web search switch */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="websearch" className="flex items-center gap-2 text-sm font-medium">
                <Search className="h-3.5 w-3.5 text-indigo-500" />
                联网搜索补充
              </Label>
              <p className="text-xs text-slate-500">为课堂内容补充最新网络资料</p>
            </div>
            <Switch
              id="websearch"
              checked={config.enableWebSearch}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, enableWebSearch: checked }))
              }
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loading ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                创建中…
              </>
            ) : (
              '开始生成'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
