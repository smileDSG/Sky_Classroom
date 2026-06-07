# O-009 测试报告

**日期**: 2026-05-20
**范围**: O-009 虚拟形象创建（小镜课堂）+ API 认证修复

---

## 总体结果

| 指标 | 数值 |
|------|------|
| 测试文件 | 146 (130 通过 / 16 失败) |
| 测试用例 | 1824 (1728 通过 / 96 失败) |
| Module C 测试 | **62/62 全部通过** |
| assistant 测试 | **8/8 全部通过** (已修复) |
| 构建 (pnpm build) | ❌ 预存问题 (pdf-providers.ts 缺 constants 模块) |

## Module C 详细结果

| 测试文件 | 结果 |
|---------|------|
| `tests/schedule/review-scheduler.test.ts` | ✅ 19/19 |
| `tests/ai/agent-memory.test.ts` | ✅ 16/16 |
| `tests/mistakes/knowledge-graph.test.ts` | ✅ 15/15 |
| `tests/graph/mastery.test.ts` | ✅ 12/12 |
| `tests/sky/assistant.test.tsx` | ✅ 8/8 (本次修复) |

## 本次变更引入的新失败

**无。** 96 个失败全部为预存问题，属于其他队员的模块 (P6-001 集成测试 1-20)。

## 本次变更明细

### 已修复的 Bug

1. **FAB 拖拽消失** (`components/ai/kagami-panel.tsx`)
   - 根因: `onDown` 用 `hasDraggedRef.current ? posRef.current : 0` 取拖拽原点，首次拖拽时为 0，FAB 跳到左上角
   - 修复: 改用 `getBoundingClientRect()` 取实际屏幕位置

2. **API 401 Missing Authentication header** (`lib/ai/providers.ts` + 网络配置)
   - 根因: `openrouter.ai` 域名在当前网络环境 POST 请求的 Authorization header 被系统性剥离
   - 修复: 将 `OPENROUTER_BASE_URL` 改为 `https://api.deepseek.com/v1`，绕过 OpenRouter 域名
   - 辅助修复: `createOpenAI` 的 `headers` 选项手动注入 Authorization (安全网)
   - 模型名修正: `deepseek/deepseek-v4-pro` → `deepseek-v4-pro` (DeepSeek API 不识别 OpenRouter 格式的斜杠前缀)

3. **测试文案未同步** (`tests/sky/assistant.test.tsx`)
   - "AI 助手" → "小镜课堂"
   - "打开 AI 助手" → "打开小镜课堂"
   - "AI 学习助手" → 匹配新欢迎语

### 已修改的文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `components/ai/kagami-panel.tsx` | Bug 修复 | FAB 拖拽: `getBoundingClientRect()` 替代 ref 推断; 移除未使用 refs |
| `lib/ai/providers.ts` | Bug 修复 | 非 OpenAI 提供商 fetch wrapper 注入 Authorization header |
| `app/api/sky/assistant/route.ts` | 模型名修正 | 默认模型 `openrouter:deepseek-v4-pro`; 移除调试日志 |
| `tests/sky/assistant.test.tsx` | 测试同步 | 更新文案匹配 O-009 品牌变更 |
| `.env.local` | 配置变更 | `OPENROUTER_BASE_URL` 改为 DeepSeek API; 更新 key |

## 预存问题清单 (非本次引入)

| 测试文件 | 失败数 | 原因 |
|---------|--------|------|
| `agent-customization` | 10 | `createAgentFromTemplate` 缺失 |
| `cache-flow` | 12 | `generateCacheKey` 缺失 |
| `classroom-lifecycle` | 1 | 场景一致性漂移 |
| `history-compression` | 1 | 历史压缩未实现 |
| `i18n-flow` | 3 | `combinePrompts` 未实现 |
| `json-repair-flow` | 24 | JSON 修复链模块缺失 |
| `monitoring-flow` | 2 | 指标断言不匹配 |
| `multi-agent-loop` | 8 | 智能体工厂函数缺失 |
| `pbl-flow` | 5 | PBL 模块未实现 |
| `prompt-hot-reload` | 5 | 提示词热更新模块缺失 |
| `provider-failover` | 4 | 提供商切换模块缺失 |
| `quality-scorer-flow` | 15 | 质量评分模块缺失 |
| `user-intervention` | 1 | 路由缺失 |
| `whiteboard-flow` | 2 | 白板布局断言不匹配 |
| `phase3-generators` | 1 | 文件大小超限 |
| `pdf-providers.ts` (构建) | — | `./constants` 模块缺失 |

## 待用户验证

- [ ] 问小镜 "1+1=?" → 应有流式回复
- [ ] 闲聊 "你好" → 傲娇回应，保持 idle 场景
- [ ] 拖拽小镜图标 → 不消失，能移动
- [ ] 语音开关 → 切换 `🔊/🔇` 状态
- [ ] Ctrl+Shift+A → 打开/关闭面板
