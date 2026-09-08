export default function SkyLoading() {
  return (
    <main
      role="status"
      aria-label="正在加载"
      className="min-h-dvh bg-slate-50 px-4 py-5 dark:bg-slate-950 md:px-8 md:py-7"
    >
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-8 w-32 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-28 rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="h-72 rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
          <div className="h-48 rounded-2xl bg-white shadow-sm dark:bg-slate-900" />
        </div>
      </div>
    </main>
  );
}
