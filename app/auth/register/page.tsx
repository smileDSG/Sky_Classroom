'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, User, Lock, Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/components/auth/auth-provider';
import { AuthLayout } from '@/components/sky/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const { register, isGuest } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength
  const hasLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const strength = (hasLen ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0);
  const strengthPercent = password.length === 0 ? 0 : ([33, 66, 100][strength] ?? 33);
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][strength] ?? '';
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-green-500'][strength] ?? '';

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register({ email: email || undefined, username, password });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isGuest) router.push('/');
  }, [isGuest, router]);

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100 mb-1">
        Create Account
      </h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        Join Sky Classroom and start learning
      </p>

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

        {/* Email (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-slate-600 dark:text-slate-300">
            Email <span className="text-muted-foreground/50 text-xs font-normal">(optional)</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className="pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-slate-600 dark:text-slate-300">
            Username
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              autoComplete="off"
              className="pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-600 dark:text-slate-300">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
          {/* Strength indicator */}
          {password.length > 0 && (
            <div className="space-y-1.5 pt-1">
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
                  {hasLen ? (
                    <Check className="inline size-3 mr-0.5" />
                  ) : (
                    <X className="inline size-3 mr-0.5" />
                  )}
                  8+ chars
                </span>
                <span className={hasUpper ? 'text-green-600 dark:text-green-400' : ''}>
                  {hasUpper ? (
                    <Check className="inline size-3 mr-0.5" />
                  ) : (
                    <X className="inline size-3 mr-0.5" />
                  )}
                  Uppercase
                </span>
                <span className={hasNumber ? 'text-green-600 dark:text-green-400' : ''}>
                  {hasNumber ? (
                    <Check className="inline size-3 mr-0.5" />
                  ) : (
                    <X className="inline size-3 mr-0.5" />
                  )}
                  Number
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-slate-600 dark:text-slate-300">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400 ${
                passwordsMismatch
                  ? 'border-red-400 dark:border-red-500 focus-visible:ring-red-400'
                  : passwordsMatch
                    ? 'border-green-400 dark:border-green-500 focus-visible:ring-green-400'
                    : ''
              }`}
            />
            {passwordsMatch && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
            )}
          </div>
          {passwordsMismatch && <p className="text-xs text-red-500">Passwords do not match</p>}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading || passwordsMismatch}
          className="w-full h-11 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-sky-300/30 dark:shadow-sky-900/30 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Creating account...
            </span>
          ) : (
            'Create Account'
          )}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-sm text-center text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center rounded-md px-1 font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
