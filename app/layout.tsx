import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import '@maic/renderer/fonts.css';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import { AccessCodeGuard } from '@/components/access-code-guard';
import { SkyClassroomEntry } from '@/components/sky-classroom-entry';
import { AuthProvider } from '@/components/auth/auth-provider';
import { ServiceWorkerReset } from '@/components/service-worker-reset';
import { OnboardingGate } from '@/components/auth/onboarding-gate';
import { DeferredGlobalServices } from '@/components/deferred-global-services';

// 商用自愈守卫: 每次部署, Next 会给 `_next/static/chunks/*.js` 换新的内容哈希名字(且
// `/_next/static/*` 缓存 1 年 immutable)。发布前就打开着的**长驻标签页**仍持旧 JS, 一旦
// 路由懒加载某个已 404 的旧 chunk, 整页交互随之失效(点宠物不开对话、拖不动)。旧标签页
// 可能一直不触发懒加载, 也就没有错误可等 —— 所以这里做两层:
//  主动: 比对「本页打包时内嵌的指纹」与「服务器当前指纹」(GET /api/sky/build-id),
//        在 pageshow / focus / 回到前台(visibilitychange) 时触发, 不一致即静默刷新一次。
//  被动: 捕获两类 chunk 失败(资源 404 / 动态 import 失败)作为活动使用时的兜底。
// 用 sessionStorage 计数, 单次会话最多自愈 3 次 —— 既能在之后多次发布里继续自愈,
// 又不会在真正坏掉的部署上无限循环。
const STALE_GUARD = `
(function(){
  if(typeof sessionStorage==='undefined') return;
  var K='sky_stale_reload_guard_v1';
  var n=parseInt(sessionStorage.getItem(K)||'0',10);
  var EXPECTED=${JSON.stringify(process.env.NEXT_PUBLIC_BUILD_ID || '')};
  // 只读句柄: 仅供探针/自查读取本标签页打包时的构建指纹
  try{ window.__SKY_BUILD_ID__ = EXPECTED; }catch(e){}
  function rescue(){ if(n>=3) return; sessionStorage.setItem(K,String(n+1)); location.reload(); }
  // ---- 主动: 构建指纹比对 ----
  var checking=false;
  function check(){
    if(checking) return; checking=true;
    try{
      fetch('/api/sky/build-id',{cache:'no-store',headers:{Accept:'application/json'}})
        .then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(d){ if(d && d.id && EXPECTED && d.id!==EXPECTED) rescue(); })
        .catch(function(){})
        .finally(function(){ checking=false; });
    }catch(e){ checking=false; }
  }
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') check(); });
  setTimeout(check, 6000); // 错过 pageshow/focus 的兜底
  // ---- 被动: chunk 404 / 懒加载失败 ----
  var CHUNK=/_next\\/static\\/chunks\\/.*\\.js/i;
  window.addEventListener('error',function(e){
    var t=e&&e.target;
    if(t && t.tagName==='SCRIPT' && CHUNK.test(t.src||'')) rescue();
  },true);
  window.addEventListener('unhandledrejection',function(e){
    var r=e&&e.reason;
    var s=r&&(r.message||String(r))||'';
    if(!s) return;
    if(/Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|_next\\/static\\/chunks/i.test(s)) rescue();
  });
})();
`;

const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: '智眸无界｜天空课堂',
  description: '智眸无界的天空课堂 — AI 驱动的互动课堂。上传 PDF，即刻生成沉浸式多智能体学习体验。',
  icons: {
    icon: '/logo-icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script id="sky-stale-build-guard" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: STALE_GUARD }} />
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={null}>
              <OnboardingGate />
            </Suspense>
            <ServerProvidersInit />
            <ServiceWorkerReset />
            <SkyClassroomEntry />
            <DeferredGlobalServices />
            <AccessCodeGuard>{children}</AccessCodeGuard>
            <Toaster position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
