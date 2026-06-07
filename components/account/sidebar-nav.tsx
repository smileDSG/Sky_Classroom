/**
 * Sidebar navigation for the account page.
 */

'use client';

import { User, CreditCard, Shield, Sparkles, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { key: 'profile', icon: User, label: '个人资料' },
  { key: 'personalization', icon: Sparkles, label: '个性化设置' },
  { key: 'plan', icon: Crown, label: '订阅方案' },
  { key: 'account', icon: CreditCard, label: '账户信息' },
  { key: 'security', icon: Shield, label: '安全设置' },
] as const;

export type AccountSection = (typeof SECTIONS)[number]['key'];

interface SidebarNavProps {
  active: AccountSection;
  onChange: (section: AccountSection) => void;
}

export function SidebarNav({ active, onChange }: SidebarNavProps) {
  return (
    <nav className="space-y-1">
      {SECTIONS.map(({ key, icon: Icon, label }) => (
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
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
