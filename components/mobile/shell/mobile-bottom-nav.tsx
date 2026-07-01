"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_ITEMS, isMobileNavActive } from "@/lib/mobile/navigation";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90"
      aria-label="移动端主导航"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isMobileNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors",
                active
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900",
              )}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
