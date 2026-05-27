'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Mail, Shield, Camera, Loader2, Check, X,
  Eye, EyeOff, Lock, Calendar, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/auth-provider';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Tab = 'profile' | 'account' | 'security';

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: Mail },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/login');
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white dark:from-slate-950 dark:to-slate-900">
        <Loader2 className="size-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-sky-50/50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/30">
        <div className="max-w-4xl mx-auto flex items-center gap-4 h-16 px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Settings</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar tabs */}
          <nav className="md:w-48 shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                      activeTab === tab.id
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200',
                    )}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'account' && <AccountTab />}
                {activeTab === 'security' && <SecurityTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ──────────────────────────────────────────────────

function ProfileTab() {
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);
  const uploadAvatar = useUserProfileStore((s) => s.uploadAvatar);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);

  const [nameDraft, setNameDraft] = useState(nickname);
  const [bioDraft, setBioDraft] = useState(bio);
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setNickname(nameDraft.trim());
    setBio(bioDraft.trim());
    setTimeout(() => {
      setSaving(false);
      toast.success('Profile updated');
    }, 300);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    const url = await uploadAvatar(file);
    if (url) toast.success('Avatar updated');
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your public profile information</p>
      </div>

      {/* Avatar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-6">
        <Label className="text-slate-600 dark:text-slate-300 mb-3 block">Avatar</Label>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-sky-200/50 dark:ring-sky-800/50 bg-slate-100 dark:bg-slate-800">
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Camera className="size-5 text-white" />
            </button>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} />
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => fileRef.current?.click()}>
              <Camera className="size-4 mr-1.5" />
              Upload Photo
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG, WebP. Max 5MB.</p>
          </div>
        </div>

        {/* Preset avatars */}
        <AnimatePresence>
          {showAvatarPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 flex-wrap pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/50">
                {AVATAR_OPTIONS.map((url) => (
                  <button
                    key={url}
                    onClick={() => { setAvatar(url); setShowAvatarPicker(false); }}
                    className={cn(
                      'size-10 rounded-full overflow-hidden transition-all cursor-pointer hover:scale-110',
                      avatar === url && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-800',
                    )}
                  >
                    <img src={url} alt="" className="size-full" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name & Bio */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-slate-600 dark:text-slate-300">Display Name</Label>
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your display name"
            maxLength={30}
            className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-600 dark:text-slate-300">Bio</Label>
          <Textarea
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            placeholder="Tell us about yourself..."
            maxLength={500}
            rows={4}
            className="resize-none bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
          />
          <p className="text-xs text-muted-foreground text-right">{bioDraft.length}/500</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="rounded-lg">
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Check className="size-4 mr-1.5" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Account Tab ──────────────────────────────────────────────────

function AccountTab() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Account</h2>
        <p className="text-sm text-muted-foreground">Your account information</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm divide-y divide-slate-100 dark:divide-slate-700/50">
        <InfoRow icon={User} label="Username" value={user?.username || '-'} />
        <InfoRow icon={Mail} label="Email" value={user?.email || 'Not set'} />
        <InfoRow
          icon={user?.emailVerified ? CheckCircle2 : AlertCircle}
          label="Email Status"
          value={user?.emailVerified ? 'Verified' : 'Not verified'}
          valueClassName={user?.emailVerified ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}
        />
        <InfoRow icon={Shield} label="Role" value={user?.role || 'user'} />
        <InfoRow
          icon={Calendar}
          label="Member Since"
          value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
        />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueClassName }: {
  icon: typeof User; label: string; value: string; valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Icon className="size-5 text-slate-400 dark:text-slate-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-sm font-medium text-slate-800 dark:text-slate-100', valueClassName)}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Security Tab ─────────────────────────────────────────────────

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasLen = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const strength = (hasLen ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Security</h2>
        <p className="text-sm text-muted-foreground">Manage your password and security settings</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-6">
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">Change Password</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 rounded-lg p-3"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800/40 rounded-lg p-3"
            >
              {success}
            </motion.div>
          )}

          <div className="space-y-1.5">
            <Label className="text-slate-600 dark:text-slate-300">Current Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="pl-10 pr-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-600 dark:text-slate-300">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="pl-10 pr-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="flex gap-1 pt-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i <= strength
                        ? strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-yellow-500' : 'bg-green-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-600 dark:text-slate-300">Confirm New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={cn(
                  'pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
                  passwordsMismatch && 'border-red-400 dark:border-red-500',
                  passwordsMatch && 'border-green-400 dark:border-green-500',
                )}
              />
              {passwordsMatch && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />}
            </div>
            {passwordsMismatch && <p className="text-xs text-red-500">Passwords do not match</p>}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading || passwordsMismatch} className="rounded-lg">
              {loading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Shield className="size-4 mr-1.5" />}
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
