'use client';

import { LoginPageContent } from '@/app/auth/login/page';

export default function MobileLoginPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col justify-center px-5 py-8">
      <LoginPageContent noAuthLayout />
    </main>
  );
}
