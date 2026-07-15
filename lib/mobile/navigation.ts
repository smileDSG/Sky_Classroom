import type { LucideIcon } from 'lucide-react';
import { Brain, Feather, Home, Star, TrendingUp, User } from 'lucide-react';

export interface MobileNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: '首页', href: '/m/sky', icon: Home, exact: true },
  { label: '智囊', href: '/m/sky/cloud-mind', icon: Brain },
  { label: '学习', href: '/m/sky/study-lab', icon: TrendingUp },
  { label: '助手', href: '/m/sky/assistant', icon: Feather },
  { label: '我的', href: '/m/sky/profile', icon: User, exact: true },
];

export const MOBILE_PRIMARY_ACTION = {
  label: '生成',
  href: '/m/sky/study-lab',
  icon: Star,
};

export function isMobileNavActive(pathname: string, item: MobileNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
