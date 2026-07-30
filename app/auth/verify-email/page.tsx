'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, Info, XCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthLayout } from '@/components/sky/auth/auth-layout';
import { Button } from '@/components/ui/button';

type Status = 'loading' | 'success' | 'already' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(5);
  const displayStatus: Status = token ? status : 'error';
  const displayMessage = token ? message : 'No verification token provided';

  useEffect(() => {
    if (!token) return;

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.message?.includes('already')) {
            setStatus('already');
          } else {
            setStatus('success');
          }
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('An error occurred during verification');
      });
  }, [token]);

  // Auto-redirect countdown for success
  useEffect(() => {
    if (displayStatus !== 'success') return;
    if (countdown <= 0) {
      window.location.href = '/auth/login';
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [displayStatus, countdown]);

  const icons = {
    loading: <Loader2 className="size-8 text-sky-500 animate-spin" />,
    success: <CheckCircle2 className="size-8 text-green-500" />,
    already: <Info className="size-8 text-sky-500" />,
    error: <XCircle className="size-8 text-red-500" />,
  };

  const titles = {
    loading: 'Verifying...',
    success: 'Email Verified!',
    already: 'Already Verified',
    error: 'Verification Failed',
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="flex flex-col items-center text-center"
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          displayStatus === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
          displayStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
          'bg-sky-100 dark:bg-sky-900/30'
        }`}>
          {icons[displayStatus]}
        </div>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          {titles[displayStatus]}
        </h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          {displayMessage}
        </p>

        {displayStatus === 'success' && (
          <p className="text-xs text-muted-foreground mb-4">
            Redirecting to login in {countdown}s...
          </p>
        )}

        {displayStatus !== 'loading' && (
          <Link href="/auth/login" className="w-full">
            <Button className="w-full h-11 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-medium rounded-xl shadow-lg shadow-sky-300/30 dark:shadow-sky-900/30 transition-all">
              Go to Login
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </Link>
        )}
      </motion.div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
