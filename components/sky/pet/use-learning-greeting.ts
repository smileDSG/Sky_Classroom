'use client';

// 宠物气泡的「今日学习提醒」话术 hook。
// 进入时异步抓取学习数据(打卡/连续天数/今日推荐/待复习), 拼成一句「该做什么 + 关心话」。
// 数据任一步失败或没有可用数据 → greeting 为 null, 由气泡回退到原有时段问候。
// 单文件、可回滚。

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLearningStats } from '@/lib/client/learning-stats';
import type { LearningStatsResponse } from '@/lib/teaching/learning-path-types';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';

interface UseLearningGreetingResult {
  /** 非空则交给气泡展示; null 表示没有可用的学习提醒 */
  greeting: string | null;
}

/** 拼接关心话的措辞池 —— 按场景给出带温度的一句话 */
function renderGreeting(
  stats: LearningStatsResponse | null,
  ctx: PersonalizationContext | null,
): string | null {
  if (!stats && !ctx) return null;

  const checkedInToday = stats?.checkedInToday;
  const streakDays = stats?.streakDays ?? 0;
  const todayMinutes = stats?.todayStudyMinutes ?? 0;
  const recommendation = ctx?.recommendation;

  // 1) 还没打卡 → 先哄着打个卡
  if (checkedInToday === false) {
    return streakDays > 0
      ? `今天还没打卡哦，已经连续 ${streakDays} 天了，打个卡别让连续断了~`
      : '今天来打个卡吧，就当是和自己说声「今天也要加油」~';
  }

  // 2) 有系统推荐的具体行动 → 告诉他现在该做什么
  if (recommendation?.title) {
    return `今天不如先「${recommendation.title}」，${recommendation.reason.replace(/[。!！?？]+$/, '')}，慢慢来，不着急~`;
  }

  // 3) 有待复习内容
  if (ctx?.dueReviews && ctx.dueReviews.length > 0) {
    return `你有 ${ctx.dueReviews.length} 项复习待处理，挑一条看就好，会的不多，别给自己太大压力~`;
  }

  // 4) 已经学了一段时间 → 鼓励 + 提醒休息
  if (todayMinutes >= 10) {
    return `今天已经学了 ${Math.round(todayMinutes)} 分钟，很棒！记得起来活动一下、喝口水哦~`;
  }

  // 5) 有些学习记录但没别的可提醒 → 温和收尾
  if (stats || (ctx && ctx.hasLearningData)) {
    return '今天也陪你一起，想学什么就说一声，不想学就歇会儿~';
  }

  return null;
}

export function useLearningGreeting(active: boolean): UseLearningGreetingResult {
  const [greeting, setGreeting] = useState<string | null>(null);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    let stats: LearningStatsResponse | null = null;
    let ctx: PersonalizationContext | null = null;

    try {
      stats = await fetchLearningStats();
    } catch {
      /* 未登录/查询失败 → 保持 null */
    }

    if (!stats?.checkedInToday) {
      // 有打卡信息就足够决定「还没打卡」的话术, 不必再等个性化接口
      setGreeting(renderGreeting(stats, null));
      return;
    }

    try {
      const res = await fetch('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
      });
      const payload = await res.json();
      if (res.ok && payload?.success && payload.data) {
        ctx = payload.data as PersonalizationContext;
      }
    } catch {
      /* 个性化接口失败 → 用现有 stats 兜底 */
    }

    setGreeting(renderGreeting(stats, ctx));
  }, []);

  useEffect(() => {
    if (!active) return;
    // 等一帧再发起, 让宠物舞台先就位, 也让气泡先显示时段问候再替换
    const id = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(id);
  }, [active, load]);

  return { greeting };
}
