'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  ChevronRight,
  CloudSun,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ── Observatory SVG Illustration ────────────────────────────────

function ObservatoryIllustration() {
  return (
    <svg viewBox="0 0 400 320" className="w-full max-w-md h-auto" fill="none">
      {/* Sky gradient background */}
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1445" />
          <stop offset="40%" stopColor="#1a237e" />
          <stop offset="70%" stopColor="#4a6cf7" />
          <stop offset="100%" stopColor="#7ec8e3" />
        </linearGradient>
        <linearGradient id="dome-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8eaf6" />
          <stop offset="100%" stopColor="#c5cae9" />
        </linearGradient>
        <linearGradient id="mountain-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a237e" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0d1b3e" />
        </linearGradient>
        <radialGradient id="sun-grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff176" />
          <stop offset="50%" stopColor="#ffb300" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ff8f00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="star-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Night sky */}
      <rect width="400" height="320" fill="url(#sky-grad)" rx="16" />

      {/* Stars */}
      {[
        { cx: 30, cy: 25, r: 1.5 },
        { cx: 80, cy: 40, r: 1 },
        { cx: 140, cy: 18, r: 2 },
        { cx: 200, cy: 35, r: 1 },
        { cx: 260, cy: 22, r: 1.5 },
        { cx: 320, cy: 45, r: 1 },
        { cx: 360, cy: 20, r: 2 },
        { cx: 50, cy: 60, r: 1 },
        { cx: 110, cy: 55, r: 1.5 },
        { cx: 180, cy: 50, r: 1 },
        { cx: 290, cy: 55, r: 1.5 },
        { cx: 340, cy: 60, r: 1 },
        { cx: 65, cy: 45, r: 0.8 },
        { cx: 230, cy: 28, r: 0.8 },
        { cx: 155, cy: 70, r: 1.2 },
      ].map((star, i) => (
        <motion.circle
          key={i}
          cx={star.cx}
          cy={star.cy}
          r={star.r}
          fill="#fff"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
          }}
        />
      ))}

      {/* Constellation lines */}
      <motion.path
        d="M30 25 L80 40 L140 18 L200 35"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.5"
        strokeDasharray="4 3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      />
      <motion.path
        d="M260 22 L320 45 L360 20"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.5"
        strokeDasharray="4 3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      />

      {/* Shooting star */}
      <motion.g
        initial={{ x: 0, y: 0, opacity: 0 }}
        animate={{ x: -80, y: 80, opacity: [0, 1, 0] }}
        transition={{ duration: 2, delay: 4, repeat: Infinity, repeatDelay: 8 }}
      >
        <line
          x1="330"
          y1="30"
          x2="300"
          y2="50"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="330" cy="30" r="2" fill="#fff" />
      </motion.g>

      {/* Sunrise glow at horizon */}
      <ellipse cx="200" cy="280" rx="200" ry="80" fill="url(#sun-grad)" opacity="0.5" />

      {/* Mountains */}
      <path
        d="M0 280 L60 220 L100 250 L140 210 L180 240 L220 200 L260 235 L300 215 L340 245 L400 225 L400 320 L0 320Z"
        fill="url(#mountain-grad)"
      />
      <path
        d="M0 290 L80 245 L130 265 L170 235 L210 258 L250 228 L290 250 L330 240 L370 262 L400 250 L400 320 L0 320Z"
        fill="#0a1628"
        opacity="0.5"
      />

      {/* Observatory dome */}
      <g>
        {/* Base */}
        <rect
          x="165"
          y="240"
          width="70"
          height="50"
          rx="4"
          fill="#1a237e"
          stroke="#3949ab"
          strokeWidth="1"
        />
        {/* Dome */}
        <path
          d="M165 245 A35 35 0 0 1 235 245"
          fill="url(#dome-grad)"
          stroke="#9fa8da"
          strokeWidth="1"
        />
        {/* Dome slit */}
        <path d="M195 210 L195 245" stroke="#7986cb" strokeWidth="1.5" />
        <path d="M205 210 L205 245" stroke="#7986cb" strokeWidth="1.5" />
        {/* Telescope peeking out */}
        <line
          x1="210"
          y1="222"
          x2="240"
          y2="200"
          stroke="#5c6bc0"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1="240"
          y1="200"
          x2="255"
          y2="190"
          stroke="#3949ab"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Window glow */}
        <rect x="175" y="255" width="12" height="12" rx="2" fill="#fff176" opacity="0.6" />
        <rect x="215" y="255" width="12" height="12" rx="2" fill="#fff176" opacity="0.6" />
      </g>

      {/* Light beam from observatory to sky */}
      <motion.path
        d="M200 220 L160 80 L240 80Z"
        fill="rgba(255,241,118,0.06)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.1, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </svg>
  );
}

// ── Decorative Celestial Scene ─────────────────────────────────

function CelestialScene() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Large ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 -left-16 w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(125,211,252,0.35) 0%, rgba(125,211,252,0) 70%)',
          }}
        />
        <div
          className="absolute bottom-0 -right-16 w-[400px] h-[400px] rounded-full opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(196,181,253,0.3) 0%, rgba(196,181,253,0) 70%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(56,189,248,0) 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 md:px-12 w-full max-w-lg">
        {/* Observatory illustration */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <ObservatoryIllustration />
        </motion.div>

        {/* Brand badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 dark:border-white/10 dark:bg-white/5 px-5 py-2.5 shadow-lg shadow-sky-200/30 backdrop-blur-md"
        >
          <img src="/logo-icon.svg" alt="" className="w-8 h-8" />
          <span className="text-lg font-bold text-slate-800 dark:text-slate-100">智眸无界</span>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed max-w-sm"
        >
          AI 驱动的互动课堂
          <br />
          上传 PDF，即刻生成沉浸式多智能体学习体验
        </motion.p>

        {/* Feature highlights */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="grid grid-cols-2 gap-2.5 w-full max-w-xs"
        >
          {[
            {
              icon: Brain,
              label: '多智能体教学',
              color: 'from-sky-500 to-blue-500',
              desc: 'AI 老师 + 同学互动',
            },
            {
              icon: Globe,
              label: '全科知识覆盖',
              color: 'from-violet-500 to-purple-500',
              desc: '数学/物理/编程等',
            },
            {
              icon: Sparkles,
              label: '智能生成课件',
              color: 'from-emerald-500 to-teal-500',
              desc: 'PDF 一键转课堂',
            },
            {
              icon: Shield,
              label: '个性化学习',
              color: 'from-amber-500 to-orange-500',
              desc: '因材施教路径',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="group flex items-center gap-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-white/80 dark:border-white/10 px-3 py-2.5 backdrop-blur-sm transition-all hover:bg-white/80 hover:shadow-md hover:shadow-sky-200/20 dark:hover:bg-white/[0.1] dark:hover:border-white/20"
            >
              <div
                className={cn(
                  'shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm',
                  item.color,
                )}
              >
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {item.label}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ── Login Form ──────────────────────────────────────────────────

function LoginForm({ onToggle }: { onToggle: () => void }) {
  const { login, isGuest } = useAuth();
  const router = useRouter();
  const [emailOrUsername, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoAccountEnabled, setDemoAccountEnabled] = useState(false);

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
    if (!isGuest) router.push('/');
  }, [isGuest, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(emailOrUsername, password);
      router.push('/');
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
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-300/30 mx-auto mb-3"
        >
          <CloudSun className="w-6 h-6 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">欢迎回来</h2>
        <p className="text-sm text-muted-foreground mt-1">登录继续你的学习之旅</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 rounded-lg p-3"
          >
            {error}
          </motion.div>
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 rounded-xl border border-sky-200/60 bg-sky-50/80 p-3 dark:border-sky-800/30 dark:bg-sky-950/30"
        >
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
        </motion.div>
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
    if (!isGuest) router.push('/');
  }, [isGuest, router]);

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
      router.push('/sky/onboarding');
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
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-300/30 mx-auto mb-3"
        >
          <GraduationCap className="w-6 h-6 text-white" />
        </motion.div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">创建账号</h2>
        <p className="text-sm text-muted-foreground mt-1">加入天空课堂，开启智能学习之旅</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 rounded-lg p-3"
          >
            {error}
          </motion.div>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {mode === 'login' ? (
              <LoginForm onToggle={handleToggle} />
            ) : (
              <RegisterForm onToggle={handleToggle} />
            )}
          </motion.div>
        </AnimatePresence>
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
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-sky-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center animate-pulse">
            <img src="/logo-icon.svg" alt="" className="w-8 h-8 brightness-0 invert" />
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
    <div className="relative min-h-dvh w-full overflow-hidden bg-sky-50 dark:bg-slate-950">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100 via-sky-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
        {/* Light mode ambient */}
        <div
          className="absolute inset-0 opacity-60 dark:opacity-0 transition-opacity duration-700"
          style={{
            background: `
              radial-gradient(ellipse 100% 60% at 0% 50%, rgba(186,230,253,0.3) 0%, transparent 60%),
              radial-gradient(ellipse 80% 50% at 100% 50%, rgba(221,214,254,0.2) 0%, transparent 50%)
            `,
          }}
        />
        {/* Dark mode ambient */}
        <div
          className="absolute inset-0 opacity-0 dark:opacity-40 transition-opacity duration-700"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 0% 50%, rgba(56,189,248,0.08) 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 100% 50%, rgba(167,139,250,0.06) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      {/* Decorative grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148,163,184,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles (light mode - clouds) */}
      <div className="absolute inset-0 dark:hidden pointer-events-none overflow-hidden">
        {[
          { delay: 0, dur: 35, y: 12, scale: 0.6, opacity: 0.25 },
          { delay: 10, dur: 45, y: 35, scale: 0.8, opacity: 0.2 },
          { delay: 20, dur: 40, y: 65, scale: 0.5, opacity: 0.15 },
          { delay: 5, dur: 50, y: 80, scale: 0.7, opacity: 0.18 },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ x: '-100%', y: `${c.y}%` }}
            animate={{ x: 'calc(100vw + 100%)' }}
            transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }}
            style={{ scale: c.scale, opacity: c.opacity }}
          >
            <svg
              viewBox="0 0 200 100"
              className="w-20 h-10 md:w-28 md:h-14 text-white/50 dark:text-white/10"
              fill="currentColor"
            >
              <ellipse cx="50" cy="60" rx="35" ry="25" />
              <ellipse cx="90" cy="45" rx="45" ry="35" />
              <ellipse cx="140" cy="55" rx="40" ry="28" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* Twinkling stars (dark mode) */}
      <div className="absolute inset-0 hidden dark:block pointer-events-none">
        {[
          { x: '8%', y: '12%', delay: 0, size: 2 },
          { x: '25%', y: '6%', delay: 0.5, size: 2.5 },
          { x: '45%', y: '18%', delay: 1, size: 1.5 },
          { x: '70%', y: '10%', delay: 1.5, size: 2 },
          { x: '88%', y: '16%', delay: 2, size: 2 },
          { x: '12%', y: '30%', delay: 3, size: 1.5 },
          { x: '80%', y: '28%', delay: 0.8, size: 2 },
          { x: '55%', y: '8%', delay: 2.5, size: 1.5 },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white pointer-events-none"
            style={{
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              boxShadow: '0 0 6px 2px rgba(255,255,255,0.3)',
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 3, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-dvh flex flex-col lg:flex-row">
        {/* Left side: Brand & Scene */}
        <div className="flex-1 flex items-center justify-center p-8 lg:p-12 xl:p-16 min-h-[50vh] lg:min-h-dvh">
          <CelestialScene />
        </div>

        {/* Divider */}
        <div className="hidden lg:flex items-center relative">
          <div className="h-3/4 w-px bg-gradient-to-b from-transparent via-sky-200/60 dark:via-slate-600/40 to-transparent" />
        </div>

        {/* Right side: Auth Panel */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 xl:p-16 pb-12 lg:pb-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full max-w-[460px]"
          >
            <AuthPanel />
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/40 dark:from-slate-950/40 to-transparent pointer-events-none" />
    </div>
  );
}
