import type { Metadata } from 'next';
import { Suspense } from 'react';
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
