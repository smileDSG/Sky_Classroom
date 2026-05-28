'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export function InviteGate() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/beta/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('验证成功，正在跳转...');
        window.location.href = '/sky';
      } else {
        toast.error(data.error || '验证失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-icon.svg" alt="天空课堂" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
            天空课堂
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Beta 内测版</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            输入邀请码
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            请输入管理员发放的邀请码以进入内测版本
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例如: BETA-XXXX"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-lg tracking-widest font-mono"
              autoFocus
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium transition-colors"
            >
              {loading ? '验证中...' : '进入内测'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
