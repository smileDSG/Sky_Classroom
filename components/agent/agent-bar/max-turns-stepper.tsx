'use client';

import { useI18n } from '@/lib/hooks/use-i18n';
import { MessageSquare, Minus, Plus } from 'lucide-react';

interface MaxTurnsStepperProps {
  maxTurns: string;
  onSetMaxTurns: (turns: string) => void;
}

/**
 * Compact +/- stepper with a numeric text input for setting the max conversation turns.
 * Clamped to the range 1–20. Non-digit characters are stripped on input.
 */
export function MaxTurnsStepper({ maxTurns, onSetMaxTurns }: MaxTurnsStepperProps) {
  const { t } = useI18n();

  const handleMinus = () => {
    const v = Math.max(1, parseInt(maxTurns || '1') - 1);
    onSetMaxTurns(String(v));
  };

  const handlePlus = () => {
    const v = Math.min(20, parseInt(maxTurns || '1') + 1);
    onSetMaxTurns(String(v));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      onSetMaxTurns('');
      return;
    }
    const v = Math.min(20, Math.max(1, parseInt(raw)));
    onSetMaxTurns(String(v));
  };

  const handleBlur = () => {
    if (!maxTurns || parseInt(maxTurns) < 1) onSetMaxTurns('1');
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 mt-1 border-t border-border/30">
      <MessageSquare className="size-3 text-muted-foreground/40 shrink-0" />
      <span className="text-[11px] text-muted-foreground/50 flex-1">
        {t('settings.maxTurns')}
      </span>
      <div className="flex items-center rounded-full bg-muted/50 h-5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleMinus();
          }}
          className="size-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-muted"
        >
          <Minus className="size-2.5" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={maxTurns}
          onChange={handleChange}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 text-[11px] font-medium tabular-nums text-center bg-transparent outline-none border-none"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePlus();
          }}
          className="size-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-muted"
        >
          <Plus className="size-2.5" />
        </button>
      </div>
    </div>
  );
}
