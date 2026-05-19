'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SkyClassroomEntry() {
  const pathname = usePathname();

  // Hide on sky classroom pages — already there
  if (pathname.startsWith('/sky')) return null;

  return (
    <Link
      href="/sky"
      className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-full bg-[#4A90D9] px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
    >
      <span>☁️</span>
      <span>天空课堂</span>
    </Link>
  );
}
