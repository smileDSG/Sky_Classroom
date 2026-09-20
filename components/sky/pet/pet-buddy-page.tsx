'use client';

import { useState } from 'react';
import { Live2DPet } from './live2d-pet';
import { VrmPet } from './vrm-pet';

// 用户自行选择显示哪只宠物(VRM 人物 与 原配黑猫 可互换)。
// 猫走 Live2DPet, VRM 走 VrmPet —— 按下方的 key 分支渲染。
const PETS = [
  {
    key: 'vrm',
    name: 'VRM 人物',
    path: '/vrm/pet',
  },
  {
    key: 'cat',
    name: '黑猫 · Hijiki',
    path: '/live2d/hijiki/hijiki.model.json',
  },
];

type PetStatus = 'loading' | 'ready' | 'error';

export function PetBuddyPage() {
  const [visible, setVisible] = useState(true);
  const [activeKey, setActiveKey] = useState<string>(PETS[0].key);
  const [status, setStatus] = useState<PetStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const active = PETS.find((p) => p.key === activeKey) ?? PETS[0];

  const statusText =
    status === 'ready'
      ? `${active.name} 已就位，就在窗口右下角`
      : status === 'error'
        ? `${active.name} 加载失败：${errorMsg}`
        : `正在叫 ${active.name}…`;

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
              {active.name}
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            宠物显示在窗口右下角。切换下方按钮决定显示哪一只，用开关打开或收起它。
          </p>
        </header>

        {/* 用户自行选择宠物 —— 分段切换 */}
        <div className="mt-8 flex items-center gap-2" role="group" aria-label="选择显示哪只宠物">
          {PETS.map((p) => {
            const on = p.key === activeKey;
            return (
              <button
                key={p.key}
                onClick={() => {
                  setActiveKey(p.key);
                  setStatus('loading');
                }}
                aria-pressed={on}
                className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                  on
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                    : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full transition-colors ${
                    on ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
                {p.name}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4">
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

        {/* 组件保持挂载, 换人与开/关都由状态驱动重建/收起, 不做整页刷新 */}
        {active.key === 'vrm' ? (
          <VrmPet
            modelPath={active.path}
            visible={visible}
            onStatusChange={(s, err) => {
              setStatus(s);
              if (err) setErrorMsg(err);
            }}
          />
        ) : (
          <Live2DPet
            modelPath={active.path}
            modelName={active.name}
            visible={visible}
            onStatusChange={(s, err) => {
              setStatus(s);
              if (err) setErrorMsg(err);
            }}
          />
        )}

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