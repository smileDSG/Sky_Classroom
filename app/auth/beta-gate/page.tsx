/**
 * Beta Gate page — invitation code + application form.
 * Shown to users who don't have beta access credentials.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

type Tab = 'invite' | 'apply';

export default function BetaGatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('invite');

  // Invite form state
  const [code, setCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Apply form state
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySubmitted, setApplySubmitted] = useState(false);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    try {
      const res = await fetch('/api/beta/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        if (data.errorCode === 'INVITATION_INVALID') {
          setInviteError(t('beta.codeInvalid'));
        } else if (data.errorCode === 'INVITATION_EXHAUSTED') {
          setInviteError(t('beta.codeExhausted'));
        } else {
          setInviteError(data.error || t('beta.codeInvalid'));
        }
        return;
      }

      setInviteSuccess(true);
      setTimeout(() => {
        router.push('/auth/register');
      }, 1500);
    } catch {
      setInviteError(t('beta.codeInvalid'));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError('');

    if (!email.trim()) {
      setApplyError('请输入邮箱地址');
      return;
    }

    setApplyLoading(true);

    try {
      const res = await fetch('/api/beta/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() || undefined }),
      });
      const data = await res.json();

      if (!data.success) {
        if (data.errorCode === 'BETA_REQUEST_DUPLICATE') {
          setApplyError(t('beta.alreadyRequested'));
        } else {
          setApplyError(data.error || '提交失败，请重试');
        }
        return;
      }

      setApplySubmitted(true);
    } catch {
      setApplyError('网络错误，请重试');
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 30%, #f0f9ff 60%, #ffffff 100%)',
      }}
    >
      {/* Ambient background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-blue-400/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-sky-200/10 to-blue-300/5 blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-sky-100/50 shadow-xl shadow-sky-200/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/25">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
            {t('beta.title')}
          </CardTitle>
          <CardDescription className="text-slate-500">
            {t('beta.subtitle')}
          </CardDescription>
        </CardHeader>

        {/* Tab switcher */}
        <div className="mx-6 mb-4 flex rounded-xl bg-sky-50 p-0.5">
          <button
            onClick={() => setTab('invite')}
            className={`flex-1 rounded-[10px] py-2 text-sm font-medium transition-all duration-300 ${
              tab === 'invite'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('beta.inviteTab')}
          </button>
          <button
            onClick={() => setTab('apply')}
            className={`flex-1 rounded-[10px] py-2 text-sm font-medium transition-all duration-300 ${
              tab === 'apply'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('beta.applyTab')}
          </button>
        </div>

        <CardContent>
          <AnimatePresence mode="wait">
            {tab === 'invite' ? (
              <motion.form
                key="invite"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleInviteSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="invite-code">{t('beta.enterCode')}</Label>
                  <Input
                    id="invite-code"
                    type="text"
                    placeholder={t('beta.codePlaceholder')}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={inviteLoading || inviteSuccess}
                    className="font-mono text-sm tracking-wider placeholder:font-sans placeholder:tracking-normal"
                    autoFocus
                  />
                </div>

                {inviteError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 bg-red-50 rounded-md p-3"
                  >
                    {inviteError}
                  </motion.div>
                )}

                {inviteSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-emerald-600 bg-emerald-50 rounded-md p-3"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('beta.codeValid')}
                    </div>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 shadow-md shadow-sky-500/25"
                  disabled={inviteLoading || inviteSuccess || !code.trim()}
                >
                  {inviteLoading ? t('beta.validating') : t('beta.validateCode')}
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="apply"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleApplySubmit}
                className="space-y-4"
              >
                {applySubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6 space-y-3"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                      <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{t('beta.submitted')}</p>
                    <p className="text-xs text-slate-500">{t('beta.submittedDesc')}</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="apply-email">{t('beta.email')}</Label>
                      <Input
                        id="apply-email"
                        type="email"
                        placeholder={t('beta.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={applyLoading}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apply-reason">{t('beta.reason')}</Label>
                      <textarea
                        id="apply-reason"
                        placeholder={t('beta.reasonPlaceholder')}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={applyLoading}
                        rows={3}
                        maxLength={500}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all resize-none"
                      />
                    </div>

                    {applyError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-600 bg-red-50 rounded-md p-3"
                      >
                        {applyError}
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 shadow-md shadow-sky-500/25"
                      disabled={applyLoading}
                    >
                      {applyLoading ? t('beta.submitting') : t('beta.submitApplication')}
                    </Button>
                  </>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
