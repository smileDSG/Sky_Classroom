'use client';

import { useParams } from 'next/navigation';
import { MobileClassroomPlayer } from '@/components/mobile/classroom/mobile-classroom-player';

export default function MobileClassroomPage() {
  const params = useParams();
  const classroomId = params?.id as string;

  if (!classroomId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#020817] text-slate-100">
        <p className="text-sm text-slate-400">课堂 ID 无效</p>
      </div>
    );
  }

  return <MobileClassroomPlayer classroomId={classroomId} />;
}
