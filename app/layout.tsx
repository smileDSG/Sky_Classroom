import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import 'animate.css';
import 'katex/dist/katex.min.css';
import '@maic/renderer/fonts.css';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import { AccessCodeGuard } from '@/components/access-code-guard';
import { SkyClassroomEntry } from '@/components/sky-classroom-entry';
import { KagamiPanel } from '@/components/ai/kagami-panel';
import { AuthProvider } from '@/components/auth/auth-provider';
import { ClassroomJobPoller } from '@/components/classroom-job-poller';
import { SlidesJobPoller } from '@/components/slides-job-poller';
import { ServiceWorkerReset } from '@/components/service-worker-reset';
import { OnboardingGate } from '@/components/auth/onboarding-gate';

const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: '天空课堂',
  description: '天空课堂 — AI 驱动的互动课堂。上传 PDF，即刻生成沉浸式多-agent学习体验。',
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
        <ThemeProvider>
          <AuthProvider>
            <OnboardingGate />
            <ServerProvidersInit />
            <ServiceWorkerReset />
            <SkyClassroomEntry />
            <KagamiPanel />
            <ClassroomJobPoller />
            <SlidesJobPoller />
            <AccessCodeGuard>{children}</AccessCodeGuard>
            <Toaster position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
