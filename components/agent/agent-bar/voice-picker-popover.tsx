'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { isNonPreviewableVoice } from './voice-utils';
import { VOXCPM_AUTO_VOICE_ID } from '@/lib/audio/voxcpm';
import { Search, ChevronDown, Volume2, VolumeX, Loader2 } from 'lucide-react';
import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

export interface VoicePickerPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceQuery: string;
  onVoiceQueryChange: (q: string) => void;
  visibleProviderGroups: Array<{
    provider: ProviderWithVoices;
    groups: ProviderWithVoices['modelGroups'];
  }>;
  isActive: (providerId: TTSProviderId, voiceId: string, modelId: string) => boolean;
  onSelect: (providerId: TTSProviderId, voiceId: string, modelId?: string) => void;
  handlePreview: (providerId: TTSProviderId, voiceId: string, modelId?: string) => void;
  previewingId: string | null;
  /** Display name shown on the trigger button pill. */
  displayName: string;
  /** When true, the pill shows a muted / disabled state and the popover is not interactive. */
  disabled?: boolean;
}

export function VoicePickerPopover({
  open,
  onOpenChange,
  voiceQuery,
  onVoiceQueryChange,
  visibleProviderGroups,
  isActive,
  onSelect,
  handlePreview,
  previewingId,
  displayName,
  disabled,
}: VoicePickerPopoverProps) {
  const { t } = useI18n();

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      onVoiceQueryChange('');
    }
  };

  if (disabled) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-muted/40 px-2.5 text-[11px] text-muted-foreground/30 shrink-0 cursor-not-allowed"
      >
        <VolumeX className="size-3 shrink-0" />
        <span className="truncate flex-1 text-left">{displayName}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 h-6 w-[100px] rounded-full bg-primary/10 hover:bg-primary/20 dark:bg-primary/25 dark:hover:bg-primary/35 px-2.5 text-[11px] text-primary/80 hover:text-primary dark:text-primary/90 transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="size-3 shrink-0" />
          <span className="truncate flex-1 text-left">{displayName}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-80 p-0 sm:w-96"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border/50 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={voiceQuery}
              onChange={(e) => onVoiceQueryChange(e.target.value)}
              autoFocus
              aria-label={t('agentBar.searchVoice')}
              placeholder={t('agentBar.searchVoice')}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {visibleProviderGroups.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              {t('agentBar.noMatchingVoices')}
            </div>
          )}
          {visibleProviderGroups.map(({ provider, groups }) =>
            groups.map((group) => (
              <div key={`${provider.providerId}::${group.modelId}`}>
                <div className="sticky top-0 bg-popover px-2 py-1 text-[11px] font-medium text-muted-foreground/60">
                  {group.modelId
                    ? `${provider.providerName} · ${group.modelName}`
                    : provider.providerName}
                </div>
                {group.voices.map((voice) => {
                  const active = isActive(provider.providerId, voice.id, group.modelId || '');
                  const previewKey = `${provider.providerId}::${voice.id}`;
                  const isPreviewing = previewingId === previewKey;
                  const canPreview = !isNonPreviewableVoice(provider.providerId, voice.id);
                  return (
                    <div
                      key={previewKey}
                      className={cn(
                        'flex items-center gap-1.5 rounded-sm transition-colors',
                        active ? 'bg-primary/10' : 'hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(provider.providerId, voice.id, group.modelId || undefined);
                        }}
                        className={cn(
                          'flex-1 text-left text-[13px] px-2 py-1.5 min-w-0 truncate',
                          active ? 'text-primary font-medium' : 'text-foreground',
                        )}
                      >
                        {voice.id === VOXCPM_AUTO_VOICE_ID
                          ? t('settings.voxcpmAutoVoice')
                          : voice.name}
                      </button>
                      {canPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(provider.providerId, voice.id, group.modelId || undefined);
                          }}
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                            isPreviewing
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-muted-foreground',
                          )}
                        >
                          {isPreviewing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
