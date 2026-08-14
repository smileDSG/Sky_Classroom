import Link from 'next/link';
import { ArrowLeft, ExternalLink, Github, GraduationCap } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-sky-600"
        >
          <ArrowLeft className="size-4" />
          返回账户设置
        </Link>

        <section className="rounded-3xl border border-sky-100 bg-white/90 p-8 shadow-xl shadow-sky-100/60 backdrop-blur md:p-12">
          <div className="mb-8 flex size-14 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-200">
            <GraduationCap className="size-8" />
          </div>

          <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-sky-600">SKY CLASSROOM</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">关于天空课堂</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            天空课堂是一个 AI
            AI互动课堂平台，通过AI老师和AI同学协作完成课程规划、内容生成、课堂互动和学习反馈。
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold">开放源代码</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                项目采用 GNU Affero General Public License v3.0（AGPL-3.0）发布。
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold">AI互动课堂</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                AI老师和AI同学围绕课程内容协作，让课堂生成、讲解和讨论连贯起来。
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://github.com/ikun1111111111/OpenMAIC-firsted-team-/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 font-medium text-white transition-colors hover:bg-sky-700"
            >
              查看开源协议
              <ExternalLink className="size-4" />
            </a>
            <a
              href="https://github.com/ikun1111111111/OpenMAIC-firsted-team-"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <Github className="size-4" />
              查看项目仓库
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
