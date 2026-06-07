/**
 * Profile editing form — avatar, nickname, bio.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { ImagePlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { toast } from 'sonner';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import { processAvatarUpload, isCustomAvatar } from '@/lib/utils/avatar-upload';

export function ProfileForm() {
  const { t } = useI18n();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHydrated(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const displayName = nickname || t('profile.defaultNickname');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processAvatarUpload(file);
      setAvatar(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.fileTooLarge'));
    }
    e.target.value = '';
  };

  const commitName = () => {
    setNickname(nameDraft.trim());
    setEditingName(false);
  };

  if (!hydrated) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-48 rounded-xl bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <button
            onClick={() => setAvatarPickerOpen(!avatarPickerOpen)}
            className="shrink-0 group/avatar relative cursor-pointer"
          >
            <div className="size-20 rounded-full overflow-hidden ring-2 ring-violet-300/50 dark:ring-violet-600/40 group-hover/avatar:ring-violet-400 transition-all">
              <img src={avatar} alt="" className="size-full object-cover" />
            </div>
          </button>

          {/* Name */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  onBlur={commitName}
                  maxLength={20}
                  placeholder={t('account.nicknamePlaceholder')}
                  className="flex-1 h-9 bg-transparent border-b-2 border-violet-400 text-base font-semibold text-foreground outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => { setNameDraft(nickname); setEditingName(true); }}
                className="group/name text-lg font-semibold text-foreground hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                {displayName}
              </button>
            )}
            <p className="text-xs text-muted-foreground/60 mt-1">
              {t('profile.avatarHint')}
            </p>
          </div>
        </div>

        {/* Avatar picker */}
        <AnimatePresence>
          {avatarPickerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pb-1 flex items-center gap-1.5 flex-wrap">
                {AVATAR_OPTIONS.map((url) => (
                  <button
                    key={url}
                    onClick={() => setAvatar(url)}
                    className={cn(
                      'size-10 rounded-full overflow-hidden bg-gray-50 dark:bg-gray-800 cursor-pointer transition-all duration-150',
                      'hover:scale-110 active:scale-95',
                      avatar === url
                        ? 'ring-2 ring-violet-400 dark:ring-violet-500'
                        : 'hover:ring-1 hover:ring-muted-foreground/30',
                    )}
                  >
                    <img src={url} alt="" className="size-full" />
                  </button>
                ))}
                <label
                  className={cn(
                    'size-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border border-dashed',
                    'hover:scale-110 active:scale-95',
                    isCustomAvatar(avatar)
                      ? 'ring-2 ring-violet-400 dark:ring-violet-500 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30'
                      : 'border-muted-foreground/30 text-muted-foreground/50',
                  )}
                  title={t('profile.uploadAvatar')}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <ImagePlus className="size-4" />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Bio */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('account.bio')}</label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('account.bioPlaceholder')}
          maxLength={200}
          rows={4}
          className="resize-none"
        />
      </div>
    </div>
  );
}
