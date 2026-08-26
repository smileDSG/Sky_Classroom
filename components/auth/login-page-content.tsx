'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, type ComponentProps } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, Eye, EyeOff, Loader2, CloudSun } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/auth/auth-provider';
import { AuthLayout } from '@/components/sky/auth/auth-layout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_PASSWORD, DEMO_USERNAME } from '@/lib/auth/demo-account';

type AuthLayoutOptions = Omit<ComponentProps<typeof AuthLayout>, 'children'>;

interface LoginPageContentProps {
  authLayoutProps?: AuthLayoutOptions;
  noAuthLayout?: boolean;
}

function LoginForm({ authLayoutProps, noAuthLayout }: LoginPageContentProps) {
  const { login, isGuest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [emailOrUsername, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoAccountEnabled, setDemoAccountEnabled] = useState(false);
  const showAdminCredentials = process.env.NODE_ENV !== 'production';

  const redirect = searchParams.get('redirect') || '/';
  const reason = searchParams.get('reason');
  const isMobileAuthFlow =
    pathname.startsWith('/m/auth') || redirect === '/m' || redirect.startsWith('/m/');
  const forgotPasswordHref = isMobileAuthFlow ? '/m/auth/forgot-password' : '/auth/forgot-password';
  const registerHref = isMobileAuthFlow ? '/m/auth/register' : '/auth/register';

  useEffect(() => {
    if (reason === 'login_required') {
      toast.warning('请先登录后再访问');
    }
  }, [reason]);

  useEffect(() => {
    let active = true;

    async function loadDemoAccountAvailability() {
      try {
        const response = await fetch('/api/auth/demo-account');
        if (!response.ok) return;
        const data = (await response.json()) as { enabled?: unknown };
        if (active && data.enabled === true) setDemoAccountEnabled(true);
      } catch {
        // The demo account is optional; failed checks remain disabled.
      }
    }

    void loadDemoAccountAvailability();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(emailOrUsername, password);
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isGuest) router.push(redirect);
  }, [isGuest, router, redirect]);

  const content = (
    <>
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-300/40 dark:shadow-sky-900/40 mb-4"
        >
          <CloudSun className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">欢迎回来</h1>
        <p className="text-sm text-muted-foreground mt-1">登录天空课堂，开启智能学习之旅</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 rounded-lg p-3"
          >
            {error}
          </motion.div>
        )}

        {/* Username */}
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-slate-600 dark:text-slate-300">
            用户名
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={emailOrUsername}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400 h-11"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-600 dark:text-slate-300">
              密码
            </Label>
            <Link
              href={forgotPasswordHref}
              className="inline-flex min-h-11 items-center rounded-md px-1 text-xs text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            >
              忘记密码？
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 pl-10 pr-12 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-sky-300/30 dark:shadow-sky-900/30 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              登录中...
            </span>
          ) : (
            '登 录'
          )}
        </Button>
      </form>

      {(showAdminCredentials || demoAccountEnabled) && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white/80 px-3 text-muted-foreground dark:bg-slate-900/80">
                默认账号
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2 rounded-xl border border-sky-200/60 bg-sky-50/80 p-3 dark:border-sky-800/30 dark:bg-sky-950/30"
          >
        {showAdminCredentials && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">开发管理员</span>
            <div className="flex min-w-0 items-center gap-2 text-sky-600 dark:text-sky-400">
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" />
                <span className="font-medium">admin</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="flex items-center gap-1.5">
                <Lock className="size-3.5" />
                <span className="font-medium">123</span>
              </span>
            </div>
          </div>
        )}
        {demoAccountEnabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-200/60 pt-2 text-sm dark:border-sky-800/30">
            <span className="font-medium text-slate-600 dark:text-slate-300">普通测试用户</span>
            <div className="flex min-w-0 items-center gap-2 text-sky-600 dark:text-sky-400">
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" />
                <span className="font-medium">{DEMO_USERNAME}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <Lock className="size-3.5 shrink-0" />
                <span className="break-all font-medium">{DEMO_PASSWORD}</span>
              </span>
            </div>
          </div>
        )}
          </motion.div>
        </>
      )}

      {/* Footer */}
      <p className="text-sm text-center text-muted-foreground mt-6">
        还没有账号？{' '}
        <Link
          href={registerHref}
          className="inline-flex min-h-11 items-center rounded-md px-1 font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          注册一个
        </Link>
      </p>
    </>
  );

  if (noAuthLayout) return content;
  return <AuthLayout {...authLayoutProps}>{content}</AuthLayout>;
}

export function LoginPageContent({ authLayoutProps, noAuthLayout }: LoginPageContentProps = {}) {
  return (
    <Suspense>
      <LoginForm authLayoutProps={authLayoutProps} noAuthLayout={noAuthLayout} />
    </Suspense>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
