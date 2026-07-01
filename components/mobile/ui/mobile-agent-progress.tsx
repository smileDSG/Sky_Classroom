import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

export type MobileAgentStageStatus = 'pending' | 'active' | 'done' | 'error';

export interface MobileAgentStage {
  id: string;
  label: string;
  status: MobileAgentStageStatus;
  description?: string;
}

interface MobileAgentProgressProps {
  stages: MobileAgentStage[];
  className?: string;
}

function StageIcon({ status }: { status: MobileAgentStageStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />;
    case 'active':
      return <Loader2 className="size-4 animate-spin text-sky-600 dark:text-sky-400" />;
    case 'error':
      return <XCircle className="size-4 text-rose-600 dark:text-rose-400" />;
    default:
      return <Circle className="size-4 text-slate-300 dark:text-slate-600" />;
  }
}

export function MobileAgentProgress({ stages, className }: MobileAgentProgressProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0"><StageIcon status={stage.status} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{stage.label}</p>
            {stage.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{stage.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
