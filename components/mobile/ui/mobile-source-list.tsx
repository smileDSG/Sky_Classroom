import { cn } from "@/lib/utils";
import { BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";

export interface MobileSource {
  title: string;
  excerpt?: string;
  href?: string;
  chapter?: string;
}

interface MobileSourceListProps {
  sources: MobileSource[];
  className?: string;
}

export function MobileSourceList({
  sources,
  className,
}: MobileSourceListProps) {
  if (sources.length === 0) {
    return (
      <p className="text-[13px] text-slate-500 dark:text-slate-400">暂无来源引用</p>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {sources.map((source, index) => {
        const content = (
          <>
            <div className="flex items-start gap-2">
              <BookOpen className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                  {source.title}
                </p>
                {source.excerpt && (
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500 dark:text-slate-400">
                    {source.excerpt}
                  </p>
                )}
                {source.chapter && (
                  <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                    {source.chapter}
                  </p>
                )}
              </div>
              {source.href && (
                <ExternalLink className="size-3.5 shrink-0 text-slate-400" />
              )}
            </div>
          </>
        );

        return (
          <li
            key={`${source.title}-${index}`}
            className="rounded-lg border border-slate-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900/50"
          >
            {source.href ? (
              <Link href={source.href} className="block">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
