import { TeacherWorkspacePage } from '@/components/sky/teaching/teacher-workspace-page';

type SearchParams = Record<string, string | string[] | undefined>;

function getSearchParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeachingRoute({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const params = await searchParams;

  return (
    <TeacherWorkspacePage
      initialTopic={getSearchParam(params, 'topic')}
      showHistoryInitially={getSearchParam(params, 'view') === 'history'}
    />
  );
}
