'use client';

// 宠物问候语气泡 —— 独立小组件, 纯新增、可回滚。
//
// 为什么需要它: oml2d 自带的 welcomeTips 气泡是画在猫的 stage 内部的, 位置正好压在
// 猫身上(见 #oml2d-tips 与 #oml2d-stage 的包围盒重叠), 看起来就是「问候语对话框和猫
// 重叠了」。而这个气泡只有猫有, VRM 人物没有。
//
// 做法: 关掉库自带的 welcomeTips(live2d-pet 里 sayHello:false), 由本组件统一渲染气泡,
// 并且**停在宠物旁边**(按宠物舞台的包围盒算位置, 默认放左侧, 左边放不下就翻到右侧),
// 所以不会压在宠物身上; 猫和 VRM 人物共用同一套问候语, 两边对话内容自然一致。
//
// 不抢指针: pointer-events: none —— 不影响拖动宠物和点击宠物开对话。

import { useEffect, useRef, useState } from 'react';

// 按时段问候。与 oml2d 内置 welcomeTips 的措辞保持一致(早上好/上午好/中午/午后/傍晚/
// 晚上好/晚安/熬夜), 这样「猫」和「人」说的话是同一套。
const GREETINGS: { from: number; to: number; text: string }[] = [
  { from: 0, to: 5, text: '这么晚还不睡吗？当心熬夜秃头哦！' },
  { from: 5, to: 9, text: '早上好！一日之计在于晨，美好的一天就要开始了。' },
  { from: 9, to: 11, text: '上午好！工作顺利嘛，不要久坐，多起来走动走动哦！' },
  { from: 11, to: 13, text: '中午了，工作了一个上午，现在是午餐时间！' },
  { from: 13, to: 17, text: '午后很容易犯困呢，来杯咖啡吧~' },
  { from: 17, to: 19, text: '傍晚了！工作一天幸苦啦~' },
  { from: 19, to: 23, text: '晚上好，今天过得怎么样呢？' },
  { from: 23, to: 24, text: '已经这么晚了呀，早点休息吧，晚安~' },
];

/** 当前时段的问候语(按小时取), 猫与 VRM 人物共用。 */
export function pickGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  const hit = GREETINGS.find((g) => h >= g.from && h < g.to);
  return hit ? hit.text : GREETINGS[1].text;
}

export function PetGreetingBubble({
  anchorId,
  showMs = 6000,
  text: customText,
}: {
  /** 宠物舞台的元素 id: 猫是 oml2d-stage, VRM 人物是 vrm-pet-stage */
  anchorId: string;
  showMs?: number;
  /** 覆盖默认问候语: 传入后气泡显示该内容而非时段寒暄(如学习提醒)。为空/undefined 时用 pickGreeting */
  text?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  // 等宠物舞台真的出现再问好, 并跟着它走。
  // 猫的 stage 是库异步插到 body 的(还带滑入动画), VRM 的也一样 —— 太早说就等于对着
  // 空气说, 而且那时没有包围盒可定位。所以计时从「锚点出现」那一刻才开始。
  // 定位按气泡的真实渲染宽度算, 并优先贴宠物轮廓, 保证既不压到宠物、又不离得太远。
  useEffect(() => {
    // 气泡固定停靠在宠物**正上方**: 位置用气泡「实际渲染尺寸」而不是估算值 ——
    // 估算值的余量会让气泡离宠物很远(实测隔了 60 多像素)。
    let raf = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let armed = false;

    const tick = () => {
      const anchor = typeof document !== 'undefined' ? document.getElementById(anchorId) : null;
      if (anchor) {
        if (!armed) {
          armed = true;
          setVisible(true);
          hideTimer = setTimeout(() => {
            setVisible(false);
            cancelAnimationFrame(raf); // 收起后停掉跟随循环
          }, showMs);
        }
        const el = ref.current;
        if (el) {
          // 贴「宠物本身」而不是贴它外面的包裹框: 舞台盒子可能比宠物宽得多(VRM 人物只占
          // 盒子中间一条, 左右各留一大片空白), 贴框边会显得隔了老远。
          // 舞台若提供了轮廓 (data-silhouette) 就用轮廓定位。
          // ⚠️ 约定: 轮廓里的值一律是**屏幕绝对坐标**(猫与 VRM 都如此), 所以直接采用,
          //    不再叠加舞台的 getBoundingClientRect —— 叠加会让气泡被推出屏幕(切到人就消失)。
          const r = anchor.getBoundingClientRect();
          let left = r.left;
          let right = r.right;
          let top = r.top;
          let height = r.height;
          const sil = anchor.getAttribute('data-silhouette');
          if (sil) {
            try {
              const s = JSON.parse(sil) as {
                left: number;
                right: number;
                top: number;
                bottom: number;
              };
              const nums = [s.left, s.right, s.top, s.bottom];
              if (
                nums.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
                s.right > s.left
              ) {
                left = s.left;
                right = s.right;
                top = s.top;
                height = Math.max(1, s.bottom - s.top);
              }
            } catch {
              /* 解析失败就用整个舞台 */
            }
          }
          const w = el.offsetWidth || 180;
          const h = el.offsetHeight || 56;
          // 气泡是fixed 定位, 不占布局 —— 若摆在宠物左侧就会压住页面内容
          // (宠物停靠右下角, 左边正是正文区)。所以摆在**正上方**。
          const GAP = 10;
          let x = left + (right - left - w) / 2; // 与宠物水平居中
          x = Math.min(Math.max(8, x), window.innerWidth - w - 8);
          // 气泡紧贴宠物轮廓**顶边**上方, 绝不压到宠物身上。
          // 之前给猫用 top + height*0.3(想落在猫耳附近), 实际把锚点下移到了猫身体里,
          // 气泡直接骑在猫头上 —— 截图里猫只露出腿和耳朵, 就是这么来的。
          // 轮廓顶(top)才是正确的锚点: 猫矮不矮都一样, 轮廓已经把模型真实形状算进去了。
          const anchorY = top;
          // 关键: 宠物停靠在屏幕**底部**, 上方空间本就紧张(算出来 y 常为负)。
          // 绝不能因为放不下就翻到宠物下方 —— 那会显得很奇怪(气泡在猫肚子下面)。
          // 正确做法: 贴着视口上沿显示, 保持"在宠物上方"这个语义方向。
          let y = anchorY - h - GAP;
          if (y < 8) y = 8; // 贴视口顶, 而非翻转
          // 硬夹在视口内: 轮廓数据万一异常, 也不能让气泡跑到屏幕外"消失"
          y = Math.min(y, Math.max(8, window.innerHeight - h - 8));
          el.style.left = `${Math.round(x)}px`;
          el.style.top = `${Math.round(y)}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [anchorId, showMs]);

  if (!visible) return null;

  // 优先显示传入的自定义内容(学习提醒); 没有就用时段问候作为兜底 ——
  // customText 异步到位后此处自动重算, 无需额外 effect
  const displayText = customText && customText.trim() ? customText : pickGreeting();

  return (
    <div
      id="pet-greeting-bubble"
      ref={ref}
      role="status"
      aria-live="polite"
      // 不抢指针: 不挡拖动宠物, 也不挡点击宠物开对话框
      className="pointer-events-none fixed z-[9999] max-w-[240px] rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 shadow-xl dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200"
      style={{ left: 8, top: 120 }}
    >
      {displayText}
    </div>
  );
}
