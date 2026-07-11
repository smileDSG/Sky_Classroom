'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Sparkles, Crown, CreditCard, Shield } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { ProfileForm } from '@/components/account/profile-form';
import { PersonalizationForm } from '@/components/account/personalization-form';
import { PlanBillingSection } from '@/components/account/plan-billing-section';
import { AccountInfo } from '@/components/account/account-info';
import { SecurityForm } from '@/components/account/security-form';
import { cn } from '@/lib/utils';

type AccountSection = 'profile' | 'personalization' | 'plan' | 'account' | 'security';

const SECTIONS: { key: AccountSection; icon: typeof User; label: string }[] = [
  { key: 'profile', icon: User, label: '个人资料' },
  { key: 'personalization', icon: Sparkles, label: '个性化' },
  { key: 'plan', icon: Crown, label: '订阅' },
  { key: 'account', icon: CreditCard, label: '账户' },
  { key: 'security', icon: Shield, label: '安全' },
];

export default function MobileAccountPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<AccountSection>('profile');

  if (!isLoading && !user) {
    router.push('/m/auth/login?redirect=%2Fm%2Faccount');
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
            <h1 className="text-lg font-extrabold text-white">账户中心</h1>
          </div>
        </header>

        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {SECTIONS.map(({ key, icon: Icon, label }) => {
            const active = activeSection === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors',
                  active
                    ? 'bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/30'
                    : 'bg-white/[0.04] text-slate-400 active:bg-white/8',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            );
          })}
        </nav>

        <section className="min-h-[50dvh]">
          {activeSection === 'profile' && <ProfileForm />}
          {activeSection === 'personalization' && <PersonalizationForm />}
          {activeSection === 'plan' && <PlanBillingSection />}
          {activeSection === 'account' && <AccountInfo />}
          {activeSection === 'security' && <SecurityForm />}
        </section>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
