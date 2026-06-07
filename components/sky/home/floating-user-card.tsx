'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  ImagePlus,
  LogOut,
  Sparkles,
  Crown,
  User,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function isCustomAvatar(src: string) {
  return src.startsWith('data:');
}

// 浮动用户卡片组件 - 全新设计
export function FloatingUserCard({
  onUpgradeOpen,
}: {
  onUpgradeOpen: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { user, logout } = useAuth();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = nickname || t('profile.defaultNickname');
  const isPremium = user?.planType === 'enterprise' || user?.planType === 'pro';

  // 点击外部关闭
  useEffect(() => {
    if (!isExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setIsEditingName(false);
        setShowAvatarPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const startEditName = () => {
    setNameDraft(nickname);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitName = () => {
    setNickname(nameDraft.trim());
    setIsEditingName(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error(t('profile.fileTooLarge'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.invalidFileType'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 未登录状态
  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <button
          onClick={() => router.push('/auth/login')}
          className="px-4 py-2 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          登录
        </button>
        <button
          onClick={() => router.push('/auth/register')}
          className="px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:scale-105 transition-all"
        >
          注册
        </button>
      </motion.div>
    );
  }

  return (
    <div ref={cardRef} className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* 折叠状态 - 精致药丸按钮 */}
      <AnimatePresence mode="wait">
        {!isExpanded && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300',
              'bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl',
              'border border-white/50 dark:border-slate-700/50',
              'shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30',
              'hover:shadow-xl hover:bg-white/90 dark:hover:bg-slate-800/90',
              isPremium && 'ring-2 ring-amber-400/50'
            )}
          >
            {/* 头像容器 - 带呼吸动画 */}
            <motion.div
              className="relative"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-xl overflow-hidden',
                  isPremium
                    ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-400/30'
                    : 'ring-2 ring-sky-400/50'
                )}
              >
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              </div>
              {/* VIP 徽章 */}
              {isPremium && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 flex items-center justify-center shadow-sm">
                  <Crown className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </motion.div>

            {/* 用户名和问候 */}
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                点击展开
              </span>
            </div>

            <ChevronDown className="w-4 h-4 text-slate-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* 展开状态 - 完整个人中心 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-0 w-80 z-50"
          >
            <div
              className={cn(
                'rounded-3xl overflow-hidden',
                'bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl',
                'border border-white/60 dark:border-slate-700/60',
                'shadow-2xl shadow-slate-300/50 dark:shadow-slate-900/50'
              )}
            >
              {/* 顶部背景 */}
              <div
                className="h-20 relative overflow-hidden"
                style={{
                  background: isPremium
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(59,130,246,0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(135,206,235,0.4) 0%, rgba(147,197,253,0.2) 100%)',
                }}
              >
                {/* 装饰圆 */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-sky-400/20 blur-xl" />

                {/* 关闭按钮 */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-white/30 hover:bg-white/50 transition-colors"
                >
                  <ChevronUp className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                </button>
              </div>

              {/* 头像区域 */}
              <div className="px-5 pb-4 -mt-8">
                <div className="flex items-end gap-4">
                  {/* 大头像 */}
                  <motion.div
                    className="relative"
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  >
                    <div
                      className={cn(
                        'w-20 h-20 rounded-2xl overflow-hidden cursor-pointer',
                        'ring-4 ring-white dark:ring-slate-700',
                        isPremium
                          ? 'shadow-lg shadow-amber-400/30'
                          : 'shadow-lg shadow-slate-300/50'
                      )}
                    >
                      <img src={avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center shadow-md">
                      <Pencil className="w-3 h-3 text-white" />
                    </div>
                  </motion.div>

                  {/* 名称编辑 */}
                  <div className="flex-1 pb-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={nameInputRef}
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          onBlur={commitName}
                          maxLength={20}
                          className="flex-1 px-2 py-1 text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b-2 border-sky-400 focus:outline-none"
                        />
                        <button
                          onClick={commitName}
                          className="p-1 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={startEditName}
                        className="group flex items-center gap-2"
                      >
                        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          {displayName}
                        </span>
                        <Pencil
                          className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </button>
                    )}
                    {isPremium && (
                      <div className="flex items-center gap-1 mt-1">
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          VIP 会员
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 头像选择器 */}
                <AnimatePresence>
                  {showAvatarPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 overflow-hidden"
                    >
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          选择头像
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {AVATAR_OPTIONS.map((url) => (
                            <button
                              key={url}
                              onClick={() => setAvatar(url)}
                              className={cn(
                                'w-10 h-10 rounded-xl overflow-hidden transition-all duration-200',
                                'hover:scale-110 active:scale-95',
                                avatar === url
                                  ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-800'
                                  : 'opacity-70 hover:opacity-100'
                              )}
                            >
                              <img src={url} alt="" className="w-full h-full" />
                            </button>
                          ))}
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center',
                              'border-2 border-dashed border-slate-300 dark:border-slate-600',
                              'text-slate-400 hover:text-sky-500 hover:border-sky-400',
                              'transition-all duration-200 hover:scale-110 active:scale-95',
                              isCustomAvatar(avatar) &&
                                'border-sky-400 bg-sky-50 dark:bg-sky-900/30'
                            )}
                          >
                            <ImagePlus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 个性签名 */}
                <div className="mt-4">
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                    maxLength={200}
                    rows={2}
                    className="resize-none text-sm bg-slate-50 dark:bg-slate-700/30 border-0 rounded-xl focus:ring-2 focus:ring-sky-400/50"
                  />
                </div>

                {/* 操作按钮 */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { setIsExpanded(false); router.push('/account'); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                      >
                        <User className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          个人中心
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>个人中心</TooltipContent>
                  </Tooltip>

                  {!isPremium && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onUpgradeOpen}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 hover:from-amber-100 hover:to-orange-100 transition-colors border border-amber-200/50 dark:border-amber-800/30"
                        >
                          <Sparkles className="w-5 h-5 text-amber-500" />
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            升级
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>升级会员</TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={logout}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                      >
                        <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors" />
                        <span className="text-xs text-slate-600 dark:text-slate-300 group-hover:text-red-500 transition-colors">
                          退出
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>退出登录</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
