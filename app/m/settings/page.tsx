'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Shield } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { ProfileForm } from '@/components/account/profile-form';
import { AccountInfo } from '@/components/account/account-info';
import { SecurityForm } from '@/components/account/security-form';
import { cn } from '@/lib/utils';

type SettingsTab = 'profile' | 'account' | 'security';

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: '个人资料', icon: User },
  { id: 'account', label: '账户', icon: Mail },
  { id: 'security', label: '安全', icon: Shield },
];

export default function MobileSettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  if (!isLoading && !user) {
    router.push('/m/auth/login?redirect=%2Fm%2Fsettings');
    return null;
  }

  if (isLoading) {
    return (
      <MobileSkyShell fullBleed>
        <div className="flex min-h-[70dvh] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        </div>
      </MobileSkyShell>
    );
  }

  return (
    <MobileSkyShell fullBleed>
      <div className="space-y-4 px-4 pb-24">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/10 bg-[#0a1120]/95 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/m/sky/profile')}
              className="flex size-9 items-center justify-center rounded-full bg-white/8 text-white active:bg-white/12"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-lg font-extrabold text-white">完整设置</h1>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#0d1728] p-1.5">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-extrabold transition-colors',
                  active ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-400 active:bg-white/8',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </nav>

        <section className="min-h-[50dvh]">
          {activeTab === 'profile' && <ProfileForm />}
          {activeTab === 'account' && <AccountInfo />}
          {activeTab === 'security' && <SecurityForm />}
        </section>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
