import type { LucideIcon } from "lucide-react";
import { Brain, Feather, Home, Star, TrendingUp, User } from "lucide-react";

export interface MobileNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: "首页", href: "/sky", icon: Home, exact: true },
  { label: "智囊", href: "/sky/cloud-mind", icon: Brain },
  { label: "工坊", href: "/sky/learning", icon: TrendingUp },
  { label: "助手", href: "/sky/assistant", icon: Feather },
  { label: "我的", href: "/account", icon: User, exact: true },
];

export const MOBILE_PRIMARY_ACTION = {
  label: "生成台",
  href: "/sky/study-lab",
  icon: Star,
};

export function isMobileNavActive(
  pathname: string,
  item: MobileNavItem,
): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
