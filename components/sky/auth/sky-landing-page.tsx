'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
  Sparkles,
  GraduationCap,
  Brain,
  Globe,
  Shield,
  CloudSun,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ── Left Brand Panel ─────────────────────────────────────────────

function CelestialScene() {
  return (
    <div className="relative w-full h-full">
      <div className="relative z-10 flex flex-col items-center justify-center gap-8 px-8 md:px-12 w-full h-full min-h-[50vh] lg:min-h-dvh py-10">
        {/* Brand */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-black/30 ring-1 ring-white/25">
            <img src="/logo-icon.svg" alt="智眸无界" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-lg">
              智眸无界
            </h1>
            <p className="mt-1.5 text-lg md:text-xl font-semibold text-sky-200/90">天空课堂</p>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-sm md:text-base text-white/85 text-center leading-relaxed max-w-sm">
          AI 驱动的互动课堂——上传 PDF，即刻生成沉浸式多智能体学习体验
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {[
            {
              icon: Brain,
              label: '多智能体教学',
              color: 'from-sky-400 to-blue-500',
              desc: 'AI 老师 + 同学互动',
            },
            {
              icon: Globe,
              label: '全科知识覆盖',
              color: 'from-violet-400 to-purple-500',
              desc: '数学/物理/编程等',
            },
            {
              icon: Sparkles,
              label: '智能生成课件',
              color: 'from-emerald-400 to-teal-500',
              desc: 'PDF 一键转课堂',
            },
            {
              icon: Shield,
              label: '个性化学习',
              color: 'from-amber-400 to-orange-500',
              desc: '因材施教路径',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="group flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/30"
            >
              <div
                className={cn(
                  'shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-md shadow-black/10',
                  item.color,
                )}
              >
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-xs text-white/60 leading-tight">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Login Form ──────────────────────────────────────────────────

function LoginForm({ onToggle }: { onToggle: () => void }) {
  const { login, isGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/sky';
  const reason = searchParams.get('reason');
  const [emailOrUsername, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoAccountEnabled, setDemoAccountEnabled] = useState(false);

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
        /* ignore */
      }
    }
    void loadDemoAccountAvailability();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isGuest) router.push(redirect);
  }, [isGuest, router, redirect]);

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

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-300/30 mx-auto mb-3">
          <CloudSun className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">欢迎回来</h2>
        <p className="text-sm text-muted-foreground mt-1">登录继续你的学习之旅</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="login-username" className="text-slate-600 dark:text-slate-300 text-sm">
            用户名
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="login-username"
              type="text"
              placeholder="请输入用户名"
              value={emailOrUsername}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="pl-10 h-11 bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-slate-600 dark:text-slate-300 text-sm">
              密码
            </Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
            >
              忘记密码？
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 pl-10 pr-12 bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
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

      {/* Demo account hint */}
      {demoAccountEnabled && (
        <div className="mt-4 rounded-xl border border-sky-200/60 bg-sky-50/80 p-3 dark:border-sky-800/30 dark:bg-sky-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">体验账号</span>
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
        </div>
      )}

      <p className="text-sm text-center text-muted-foreground mt-6">
        还没有账号？{' '}
        <button
          type="button"
          onClick={onToggle}
          className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
        >
          注册一个
        </button>
      </p>
    </div>
  );
}

// ── Register Form ───────────────────────────────────────────────

function RegisterForm({ onToggle }: { onToggle: () => void }) {
  const { register, isGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const strength = (hasLen ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0);
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'][strength] ?? '';

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if (!isGuest) router.push(redirect || '/');
  }, [isGuest, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码长度至少为 8 个字符');
      return;
    }

    setLoading(true);
    try {
      await register({ email: email || undefined, username, password });
      router.push(redirect || '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-300/30 mx-auto mb-3">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">创建账号</h2>
        <p className="text-sm text-muted-foreground mt-1">加入天空课堂，开启智能学习之旅</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="reg-email" className="text-slate-600 dark:text-slate-300 text-sm">
            邮箱 <span className="text-muted-foreground/50 text-xs font-normal">（选填）</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className="pl-10 h-11 bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-username" className="text-slate-600 dark:text-slate-300 text-sm">
            用户名
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="reg-username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              autoComplete="off"
              className="pl-10 h-11 bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-password" className="text-slate-600 dark:text-slate-300 text-sm">
            密码
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="至少输入 8 个字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 pl-10 pr-12 bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="space-y-1.5 pt-1 animate-fade-in-up">
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i <= strength ? strengthColor : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className={hasLen ? 'text-green-600 dark:text-green-400' : ''}>
                  <Check className={`inline size-3 mr-0.5 ${hasLen ? '' : 'hidden'}`} />
                  <X className={`inline size-3 mr-0.5 ${!hasLen ? '' : 'hidden'}`} />
                  至少 8 位
                </span>
                <span className={hasUpper ? 'text-green-600 dark:text-green-400' : ''}>
                  <Check className={`inline size-3 mr-0.5 ${hasUpper ? '' : 'hidden'}`} />
                  <X className={`inline size-3 mr-0.5 ${!hasUpper ? '' : 'hidden'}`} />
                  大写字母
                </span>
                <span className={hasNumber ? 'text-green-600 dark:text-green-400' : ''}>
                  <Check className={`inline size-3 mr-0.5 ${hasNumber ? '' : 'hidden'}`} />
                  <X className={`inline size-3 mr-0.5 ${!hasNumber ? '' : 'hidden'}`} />
                  数字
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-confirm" className="text-slate-600 dark:text-slate-300 text-sm">
            确认密码
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="reg-confirm"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`pl-10 h-11 bg-white/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400 ${
                passwordsMismatch
                  ? 'border-red-400 dark:border-red-500'
                  : passwordsMatch
                    ? 'border-green-400 dark:border-green-500'
                    : ''
              }`}
            />
            <Check
              className={`absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500 ${
                passwordsMatch ? '' : 'hidden'
              }`}
            />
          </div>
          {passwordsMismatch && <p className="text-xs text-red-500">两次输入的密码不一致</p>}
        </div>

        <Button
          type="submit"
          disabled={loading || passwordsMismatch}
          className="w-full h-11 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-sky-300/30 dark:shadow-sky-900/30 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              正在创建账号...
            </span>
          ) : (
            '创建账号'
          )}
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground mt-6">
        已有账号？{' '}
        <button
          type="button"
          onClick={onToggle}
          className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
        >
          立即登录
        </button>
      </p>
    </div>
  );
}

// ── Auth Panel ──────────────────────────────────────────────────

function AuthPanel() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleToggle = useCallback(() => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
  }, []);

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={cn(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200',
            mode === 'login'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
          )}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={cn(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200',
            mode === 'register'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
          )}
        >
          注册
        </button>
      </div>

      {/* Form */}
      <div className="relative overflow-hidden rounded-2xl border border-white/60 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 shadow-xl shadow-sky-200/20 dark:shadow-slate-950/40">
        {mode === 'login' ? (
          <LoginForm onToggle={handleToggle} />
        ) : (
          <RegisterForm onToggle={handleToggle} />
        )}
      </div>
    </div>
  );
}

// ── Main Landing Page ──────────────────────────────────────────

export function SkyLandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !user.role.includes('guest')) {
      router.replace('/sky');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-sky-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg">
            <img src="/logo-icon.svg" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (user && !user.role.includes('guest')) {
    return null;
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      {/* Full-bleed background image */}
      <img
        src="/sky-observatory.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-[1.12]"
      />
      {/* Soft vignette for readability */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/25 via-transparent to-black/30" />

      {/* Main content */}
      <div className="relative z-10 min-h-dvh flex flex-col lg:flex-row">
        {/* Left side: Brand & Scene */}
        <div className="relative flex-1 min-h-[50vh] lg:min-h-dvh">
          <CelestialScene />
        </div>

        {/* Right side: Auth Panel */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 xl:p-16 pb-12 lg:pb-0">
          <div className="w-full max-w-[460px]">
            <AuthPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
