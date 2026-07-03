import { ProfileCompletionPage } from '@/components/sky/learning/profile-completion-page';

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LearningProfilePage({
  searchParams = {},
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await searchParams;
  const from = firstParam(params.from);
  const returnSource = from === 'learning' || from === 'workshop' ? 'learning' : 'starTips';

  return <ProfileCompletionPage returnSource={returnSource} />;
}
