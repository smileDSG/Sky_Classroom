import { TestChecklist } from '@/components/beta/test-checklist';

export const metadata = {
  title: '测试清单 - 天空课堂 Beta',
};

export default function TestChecklistPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900 py-8 px-4">
      <TestChecklist />
    </div>
  );
}
