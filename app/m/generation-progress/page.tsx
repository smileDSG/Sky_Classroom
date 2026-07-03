import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';

export default async function MobileGenerationProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jobId = typeof params.jobId === 'string' ? params.jobId : '';
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';

  return <MobileSkyFrame src={`/generation-progress${query}`} />;
}
