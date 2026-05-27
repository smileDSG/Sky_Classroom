'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthLayout } from '@/components/sky/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = 'form' | 'loading' | 'success' | 'error';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('form');
  const [error, setError] = useState('');

  const hasLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const strength = (hasLen ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No reset token provided');
    }
  }, [token]);

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

    setStatus('loading');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
      } else {
        setStatus('form');
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setStatus('form');
      setError('An error occurred. Please try again.');
    }
  };

  // Success state
  if (status === 'success') {
    return (
      <AuthLayout>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <CheckCircle2 className="size-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Password Reset!
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your password has been updated successfully.
          </p>
          <Button
            onClick={() => router.push('/auth/login')}
            className="w-full h-11 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-sky-300/30 dark:shadow-sky-900/30 transition-all"
          >
            Go to Login
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </motion.div>
      </AuthLayout>
    );
  }

  // Error state (no token)
  if (status === 'error' && !token) {
    return (
      <AuthLayout>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <XCircle className="size-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Invalid Link
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Link href="/auth/forgot-password" className="w-full">
            <Button variant="outline" className="w-full h-11 rounded-xl">
              Request New Link
            </Button>
          </Link>
        </motion.div>
      </AuthLayout>
    );
  }

  // Form state
  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100 mb-1">
        Set New Password
      </h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        Enter your new password below
      </p>

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

        {/* New Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-600 dark:text-slate-300">
            New Password
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
              className="pl-10 pr-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="flex gap-1 pt-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    i <= strength
                      ? strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-yellow-500' : 'bg-green-500'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
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
              className={`pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400 ${
                passwordsMismatch
                  ? 'border-red-400 dark:border-red-500'
                  : passwordsMatch
                    ? 'border-green-400 dark:border-green-500'
                    : ''
              }`}
            />
            {passwordsMatch && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
            )}
          </div>
          {passwordsMismatch && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={status === 'loading' || passwordsMismatch}
          className="w-full h-11 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-sky-300/30 dark:shadow-sky-900/30 transition-all"
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Resetting...
            </span>
          ) : (
            'Reset Password'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
