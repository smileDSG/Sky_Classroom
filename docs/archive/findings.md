# 个性化学习算法 V1 现状记录

## 已有能力

- `lib/adaptive-learning/contracts/learner.ts` 已有学习事件、知识状态契约。
- `lib/adaptive-learning/profile/event-recorder.ts` 已有答题和复习事件入口。
- `lib/adaptive-learning/profile/knowledge-state-engine.ts` 已有 Beta 掌握度和 retention 逻辑。
- `lib/adaptive-learning/profile/knowledge-state-updater.ts` 也存在另一套知识状态更新逻辑。
- `lib/adaptive-learning/profile/projection-builder.ts` 已有 teaching/planning projection。
- Chat、solve、learning-path 已部分消费 projection。
- Cloud Mind、dashboard、memory、teaching 多处仍直接消费 `buildStudentProfile()`。

## 主要风险

1. 两套知识状态更新器参数不同，必须先统一，否则同一行为在不同入口产生不同画像。
2. `StudentProfile` 文件缓存可能导致推荐延迟；事件成功后必须主动失效或绕过旧缓存。
3. 用户明确指定主题不能被算法覆盖。
4. 冷启动时只能输出诊断建议，不能伪造掌握度。
5. 推荐必须保留原因、版本、水位，便于测试和解释。

## V1 决策规则

```text
confidence < 0.40 -> diagnostic
mastery < 0.55 -> teach
retention < 0.70 -> review
otherwise -> quiz/challenge
```

规则先固定，数据积累后再考虑 IRT 或 bandit。

## 本次实现边界

- 工作区存在大量既有未提交改动；本次只新增/修改个性化实验闭环相关文件。
- 先做纯内存演示状态，不把调试操作写入真实用户学习记录。
- API 层通过现有 `getServerStorage` / `requireAuth` 读取真实用户；演示用户使用独立内存状态。
- 页面先验证决策行为，后续再接入 Cloud Mind 正式入口。

## 代码接入约定

- API 响应使用 `apiSuccess` / `apiError`。
- 实验页挂载在 `app/sky/learning/personalization-lab/page.tsx`。
- 交互组件放在 `components/sky/learning/personalization-lab.tsx`。
- 首个测试只验证公开决策接口，不绑定内部实现。
- 调试状态按演示 session 存在进程内存中，重启服务自动清空。
