import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';

export default async function MobileClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MobileSkyFrame src={`/classroom/${encodeURIComponent(id)}`} />;
}
