# 学情画像对话联动三项改进设计

日期：2026-09-05
状态：已批准

## 背景与问题

`/sky/learning/profile`（完善学习情况）页面的对话式画像与画像上下文本已形成闭环：对话抽取结果经 `POST /api/sky/student/profile/conversation` 转为 profile signals 落库，`GET /api/sky/cloud-mind/personalization-context` 再从持久化 signals 重建 `conversationProfile`，影响推荐主题、难度推导与辅导策略。但实际联动存在三个缺陷：

1. **抽取是纯规则/正则**（`lib/student/conversation-profile.ts`），依赖"我是XX专业""两周内"等固定句式，表达自由一点就抽不到，导致画像补不全。
2. **匿名用户不落库**：路由中 `profileSignals` 的生成条件是 `currentUser && input.trim()`，未登录时抽取结果只在本页临时显示，刷新即失。且现有测试 `tests/student/profile-conversation-route.test.ts` 已写明"匿名也应落库 default-user"的期望，当前处于失败状态——这是一处回归。
3. **聊天后页面不同步**：聊天后右侧预览靠客户端 `onPatchChange` 就地更新，但页面不会重新请求 personalization-context，顶部完成度与参考建议需手动刷新才能与服务端状态一致。

## 已确认的决策

- 抽取策略：**LLM 优先，规则兜底**。配置了 LLM key 就走模型抽取，没 key 或失败时自动降级到现有规则抽取。规则代码原样保留当兜底。（已否决：纯 LLM 无兜底；LLM 与规则并行取优）
- 匿名持久化：**写入 default-user**，沿用仓库现有约定（未登录 userId 一律 `default-user`）。（已否决：匿名 cookie + 登录合并；保持不落库改为登录门控）
- 已知副作用（接受）：匿名用户写入 default-user，多人匿名共用环境会互相污染。
- 范围外：`buildSoftwareCupProfile`（软件杯 demo 8 维画像）保持不动。

## 改动 1 — 对话抽取改为 LLM 优先、规则兜底

### 新模块 `lib/student/conversation-profile-llm.ts`

复用现有类型 `ConversationProfileExtractionResult`（`lib/student/conversation-profile.ts`），导出：

```ts
export async function extractConversationProfileWithLLM(input: {
  message: string;
  stage: ConversationProfileStage;
  model: ResolvedModel; // 来自 resolveModelFromRequest
}): Promise<ConversationProfileExtractionResult>
```

- 用 `callLLM`（`lib/ai/llm.ts`，自带重试/超时/健康检查）发起调用，`source` 标记为 `student-profile-conversation`。
- 系统提示词描述 9 个画像维度（majorBackground / learningGoal / knowledgeBase.weakPoints / cognitiveStyle / errorPatternPreference / resourcePreference / interactionPreference / learningPace / currentLearningState）的定义与 stage 语境，要求只输出 JSON：各维度带 `value / confidence(0-1) / evidence[]`（knowledgeBase 为 `strongPoints / weakPoints / confidence / evidence`），顶层带 `nextQuestion`、`needsConfirmation`。
- Zod schema 校验 LLM 输出并裁剪到合法形状；JSON 解析失败或校验不过 → 抛错，由路由降级。
- 超时 25s（聊天场景不能等 callLLM 默认 90s），重试 1 次。
- 置信度由模型自评（0-1），沿用现有 `< 0.72 视为待确认` 的展示阈值，不改判定逻辑。

### 路由 `app/api/sky/student/profile/conversation/route.ts` 改造

1. 先 `resolveModelFromRequest(req, body)` 解析模型（客户端不传时回落服务端 DEFAULT_MODEL）；解析失败不阻断，记日志后走规则。
2. 解析出模型 → 调 LLM 抽取；无模型、LLM 报错 → 回落 `extractConversationProfile` 规则版。
3. 响应 data 新增 `extractionSource: 'llm' | 'rules'` 字段，便于调试与测试断言。

## 改动 2 — 匿名信号落库 default-user

`conversation/route.ts` 中 `profileSignals` 生成条件从 `currentUser && input.trim()` 放宽为 `input.trim()`；userId 用已有的 `currentUser?.id ?? DEFAULT_PROFILE_USER_ID`（`'default-user'`）。

验收标准：`tests/student/profile-conversation-route.test.ts` 由失败转为通过（该测试即本改动的回归验收）。

## 改动 3 — 聊天后即时刷新服务端画像

`components/sky/learning/profile-completion-page.tsx`：

- 把 useEffect 内的 `loadPersonalization` 提为 `useCallback`，供挂载与聊天回调共用。
- 页面侧 `onPatchChange` 回调改为：`setPatch(patch)` 后立即触发一次 `loadPersonalization()`（服务端是先落库再响应，reload 必能取到最新 signals）。
- reload 失败时保留旧数据，走现有 error banner，不清空已展示内容。
- `ProfileOnboardingChat` 组件零改动（`onPatchChange` 已存在）。

## 测试

- 新增 `tests/student/conversation-profile-llm.test.ts`：mock `callLLM`，覆盖三条路径——正常 JSON 输出成功解析；非法 JSON 回落规则；Zod 校验失败回落规则。
- `tests/student/profile-conversation-route.test.ts` 转绿即为改动 2 验收；补充断言 `extractionSource` 字段存在。
- 全量本地检查：`pnpm check`、`pnpm lint`、`npx tsc --noEmit`、`pnpm test`（环境限制时用 npx 直调等效命令）。

## 错误处理汇总

| 失败点 | 行为 |
| --- | --- |
| 未配置 LLM key / 模型解析失败 | 走规则抽取，响应 `extractionSource: 'rules'` |
| LLM 超时（25s）/ 报错 | 重试 1 次后仍失败 → 走规则抽取 |
| LLM 输出非法 JSON / Zod 校验不过 | 走规则抽取 |
| personalization-context reload 失败 | 保留旧数据 + 现有 error banner |
