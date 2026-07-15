import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TeachingRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const params = await searchParams;
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v);
    } else if (value !== undefined) {
      sp.set(key, value);
    }
  }

  const qs = sp.toString();
  redirect(`/sky/cloud-mind/teaching${qs ? `?${qs}` : ''}`);
}
