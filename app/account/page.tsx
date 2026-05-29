/**
 * Account center — profile, account info, security.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { SidebarNav, type AccountSection } from '@/components/account/sidebar-nav';
import { ProfileForm } from '@/components/account/profile-form';
import { PersonalizationForm } from '@/components/account/personalization-form';
import { AccountInfo } from '@/components/account/account-info';
import { SecurityForm } from '@/components/account/security-form';
import { PlanBillingSection } from '@/components/account/plan-billing-section';
import { Button } from '@/components/ui/button';

export default function AccountPage() {const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<AccountSection>('profile');

  // Redirect to login if not authenticated (after initial load)
  if (!isLoading && !user) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{'请先登录后再访问'}</p>
          <Button onClick={() => router.push('/auth/login')}>
            {'返回首页'}
          </Button>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileForm />;
      case 'personalization':
        return <PersonalizationForm />;
      case 'plan':
        return <PlanBillingSection />;
      case 'account':
        return <AccountInfo />;
      case 'security':
        return <SecurityForm />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-sky-100/60 dark:border-sky-900/30 flex items-center px-4 md:px-8 gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/')}
          className="gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">{'返回首页'}</span>
        </Button>
        <div className="flex items-center gap-2">
          <User className="size-5 text-sky-500" />
          <h1 className="text-lg font-semibold">{'账户中心'}</h1>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-12 px-4 md:px-8">
        <div className="max-w-5xl mx-auto flex gap-8">
          {/* Sidebar */}
          <aside className="w-52 shrink-0">
            <div className="sticky top-20">
              <SidebarNav
                active={activeSection}
                onChange={setActiveSection}
                t={t}
              />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="max-w-2xl">
              {renderSection()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
