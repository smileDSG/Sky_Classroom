'use client';

import { useState } from 'react';
import { Live2DPet } from './live2d-pet';

// 固定单只模型: 黑猫 Hijiki(本地自托管)。想换猫换 path 即可, 其余不动。
const CAT = {
  name: '黑猫 · Hijiki',
  path: '/live2d/hijiki/hijiki.model.json',
};

type PetStatus = 'loading' | 'ready' | 'error';

export function PetBuddyPage() {
  const [visible, setVisible] = useState(true);
  const [status, setStatus] = useState<PetStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const statusText =
    status === 'ready'
      ? '小镜已就位，就在窗口右下角'
      : status === 'error'
        ? `小镜加载失败：${errorMsg}`
        : '正在叫小镜…';

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 px-6 py-10">
      <div className="mx-auto max-w-xl">
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-sky-500">
            Live2D 陪伴宠物 · 预览
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            小镜的「活」版本
            <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
              {CAT.name}
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            宠物显示在窗口右下角。用下面的开关打开或收起它。
          </p>
        </header>

        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={() => setVisible((v) => !v)}
            className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-3 transition-all ${
              visible
                ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                : 'border-slate-200 bg-white/70 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full transition-colors ${
                visible ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
            <span className="text-sm font-semibold">{visible ? '关闭宠物' : '打开宠物'}</span>
          </button>

          <span className="text-sm text-slate-400">
            {visible ? '宠物已唤出' : '宠物已收起'}
          </span>
        </div>

        {/* 组件保持挂载, 打开/关闭由 stageSlide 控制, 不重建 */}
        <Live2DPet
          modelPath={CAT.path}
          modelName={CAT.name}
          visible={visible}
          onStatusChange={(s, err) => {
            setStatus(s);
            if (err) setErrorMsg(err);
          }}
        />

        {/* 把加载结果直接显示到页面上, 不用再猜猫在哪 */}
        <p
          className={`mt-6 text-sm font-medium ${
            status === 'error'
              ? 'text-red-500'
              : status === 'ready'
                ? 'text-emerald-500'
                : 'text-slate-400'
          }`}
        >
          {statusText}
        </p>
      </div>
    </main>
  );
}