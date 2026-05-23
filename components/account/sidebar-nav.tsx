/**
 * Sidebar navigation for the account page.
 */

'use client';

import { User, CreditCard, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { key: 'profile', icon: User, labelKey: 'profileSection' },
  { key: 'account', icon: CreditCard, labelKey: 'accountSection' },
  { key: 'security', icon: Shield, labelKey: 'securitySection' },
] as const;

export type AccountSection = (typeof SECTIONS)[number]['key'];

interface SidebarNavProps {
  active: AccountSection;
  onChange: (section: AccountSection) => void;
  t: (key: string) => string;
}

export function SidebarNav({ active, onChange, t }: SidebarNavProps) {
  return (
    <nav className="space-y-1">
      {SECTIONS.map(({ key, icon: Icon, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            active === key
              ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4" />
          <span>{t(`account.${labelKey}`)}</span>
        </button>
      ))}
    </nav>
  );
}
