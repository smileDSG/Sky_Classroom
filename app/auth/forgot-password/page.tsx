'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthLayout } from '@/components/sky/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-4">
            <CheckCircle2 className="size-8 text-sky-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Check Your Email
          </h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            If an account exists with that email/username, we&apos;ve sent a password reset link.
            Check your inbox and follow the instructions.
          </p>
          <Link href="/auth/login" className="w-full">
            <Button variant="outline" className="w-full h-11 rounded-xl">
              <ArrowLeft className="size-4 mr-2" />
              Back to Login
            </Button>
          </Link>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-slate-100 mb-1">
        Forgot Password
      </h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        Enter your email or username and we&apos;ll send you a reset link
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

        <div className="space-y-1.5">
          <Label htmlFor="emailOrUsername" className="text-slate-600 dark:text-slate-300">
            Email or Username
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <Input
              id="emailOrUsername"
              type="text"
              placeholder="you@example.com or username"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
              className="pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus-visible:ring-sky-400"
            />
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
              Sending...
            </span>
          ) : (
            'Send Reset Link'
          )}
        </Button>
      </form>

      <p className="text-sm text-center text-muted-foreground mt-6">
        Remember your password?{' '}
        <Link
          href="/auth/login"
          className="font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
