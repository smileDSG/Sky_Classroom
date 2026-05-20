# Module C API 工作计划书

> 负责人：队员3 / 基于 `task/API_DEVELOPMENT_PLAN.md` C-001~C-005 / 日期：2026-05-20

---

## 已有基础（队长 P1-002 产出，不修改）

| 文件 | 状态 |
|------|------|
| `lib/storage/dao/mistakes.ts` | ✅ 完整 DAO（CRUD + 艾宾浩斯 + 筛选 + 分页 + 错因分布） |
| `lib/storage/dao/knowledge-graph.ts` | ✅ 图谱 DAO |
| `lib/storage/storage-types.ts` | ✅ 统一存储接口 |
| `lib/storage/storage-factory.ts` | ✅ 工厂 + 自动降级 |

## 已有基础（我们 C-001/C-002 前端产出，不修改）

| 文件 | 状态 |
|------|------|
| `lib/mistakes/cause-analyzer.ts` | ✅ 客户端规则引擎错因分析 |
| `lib/mistakes/knowledge-graph.ts` | ✅ 图谱构建 + 掌握度 + 路径推荐 |
| `lib/mistakes/bridge.ts` | ✅ 主应用测验→天空课堂同步 |
| `lib/mistakes/types.ts` | ✅ 客户端类型定义 |

---

## C-001 错题本管理 API

### 文件 1：`app/api/sky/mistakes/route.ts`（重写）

| 项 | 内容 |
|----|------|
| **功能函数** | `GET` 查询错题 / `POST` 新增错题 / `PATCH` 标记复习 / `DELETE` 删除错题 |
| **调试检测点** | ① GET 支持 errorType/reviewed/masteryBelow/page/pageSize 参数 ② POST 接收 MistakeBookEntry 并自动从批改结果入库 ③ PATCH 调 DAO.recordReview 走艾宾浩斯 ④ DELETE 软删除+返回成功 ⑤ 无 storage 时返回空数组（优雅降级） |
| **测试方案** | `tests/mistakes/mistakes-api.test.ts` |
| **预期测试结果** | CRUD 4 操作正确 / 筛选+分页正确 / 艾宾浩斯复习链正确 / 错误处理统一格式 |

### 文件 2：`lib/mistakes/mistake-types.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | 对齐 `lib/storage/dao/mistakes.ts` 的 `MistakeBookEntry` / `ErrorType` 类型，客户端可导入 |
| **调试检测点** | ① ErrorType 与 DAO 一致 ② MistakeBookEntry 字段与 DAO 一致 |
| **测试方案** | 类型编译检查 |
| **预期测试结果** | tsc --noEmit 无报错 |

### 文件 3：`lib/mistakes/review-tracker.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `calculateNextReview(reviewCount)` 计算艾宾浩斯下次复习 / `getDueForReview(mistakes)` 筛选到期复习项 / `getReviewStats(mistakes)` 复习统计 |
| **调试检测点** | ① reviewCount 0→下次1天后 ② reviewCount 1→下次2天后 ③ reviewCount 5（完成所有间隔）→nextReview 30天后 ④ masteryLevel 与 reviewCount 对应 |
| **测试方案** | `tests/mistakes/review-tracker.test.ts` |
| **预期测试结果** | 6 个间隔计算正确 / mastery 计算正确 / getDueForReview 筛选正确 |

---

## C-002 知识图谱 API

### 文件 4：`app/api/sky/knowledge-graph/route.ts`（重写）

| 项 | 内容 |
|----|------|
| **功能函数** | `GET` 读取错题数据 → 构建知识图谱 → 返回 nodes/edges/weakPoints |
| **调试检测点** | ① 从 DAO 读取错题 ② 调用 `buildKnowledgeGraph(mistakes)` 构建图谱 ③ 返回完整 JSON（含 mastery 百分比） ④ 无错题时返回空图谱 |
| **测试方案** | `tests/graph/builder.test.ts` |
| **预期测试结果** | 空数据→空图谱 / 有数据→structured nodes+edges / mastery 计算正确 / weakPoints 高亮 |

### 文件 5：`lib/graph/types.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `KnowledgeNode` / `KnowledgeEdge` / `KnowledgeGraphResponse` 类型 |
| **调试检测点** | ① 与 `lib/mistakes/types.ts` 兼容 ② 与 API response 格式一致 |
| **测试方案** | 类型编译检查 |
| **预期测试结果** | tsc --noEmit 无报错 |

### 文件 6：`lib/graph/builder.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `buildGraphFromMistakes(mistakes)` 从 DAO 错题构建图谱 / `calculateMastery(knowledgePoint)` 掌握度 |
| **调试检测点** | ① 从 MistakeBookEntry[] 提取知识点 ② 去重+合并 ③ 错误率→掌握度映射 ④ 薄弱点阈值 50% |
| **测试方案** | `tests/graph/builder.test.ts` |
| **预期测试结果** | 与 `lib/mistakes/knowledge-graph.ts` 计算结果一致 |

### 文件 7：`lib/graph/mastery.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `getMasteryLevel(errorCount, totalCount)` 错误率→掌握度 / `getWeakPoints(nodes, threshold?)` 薄弱点列表 |
| **调试检测点** | ① 0错→100% ② 50%错→50% ③ 100%错→0% ④ 阈值可配置 |
| **测试方案** | `tests/graph/mastery.test.ts` |
| **预期测试结果** | 边界正确 / 阈值筛选正确 |

### 文件 8：`lib/graph/highlight.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `getHighlightedNodes(nodes)` 标记薄弱点 / `getRecommendation(weakPoints)` 生成推荐 |
| **调试检测点** | ① 薄弱点按掌握度排序 ② 推荐包含知识点名称+当前掌握度+建议练习量 |
| **测试方案** | `tests/graph/highlight.test.ts` |
| **预期测试结果** | 排序正确 / 推荐文案生成正确 |

---

## C-003 AI 助手对话 API

### 文件 9：`app/api/sky/assistant/route.ts`（修改）

| 项 | 内容 |
|----|------|
| **功能函数** | `POST` 已有 LLM 流式响应，**新增**：注入错题/知识图谱上下文 |
| **调试检测点** | ① 已有功能不变（流式 SSE 正常） ② 新增：从 DAO 读取用户错题数据 ③ 新增：注入薄弱知识点到 systemPrompt ④ 新增：注入错题统计到 systemPrompt ⑤ 无错题数据时降级为通用回答 |
| **测试方案** | `tests/assistant/assistant-api.test.ts` |
| **预期测试结果** | 流式响应正常 / 上下文注入正确 / 无数据时优雅降级 |

### 文件 10：`lib/assistant/context-injector.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `injectMistakeContext(basePrompt, mistakes)` 注入错题上下文 / `injectGraphContext(basePrompt, graph)` 注入图谱上下文 / `buildSystemPrompt(subject, difficulty, style, context?)` 构建完整系统提示词 |
| **调试检测点** | ① 有错题→提示词包含薄弱点信息 ② 有图谱→提示词包含掌握度信息 ③ 无数据→返回 base prompt 不变 ④ 提示词长度不超过 token 限制 |
| **测试方案** | `tests/assistant/context-injector.test.ts` |
| **预期测试结果** | 注入格式正确 / 无副作用 / Token 不超限 |

### 文件 11-12：`lib/assistant/stream.ts` + `conversation.ts`（新建）

| 项 | 内容 |
|----|------|
| **功能函数** | `stream.ts`: SSE 流式输出封装 / `conversation.ts`: 对话历史管理 |
| **调试检测点** | ① stream.ts: text_delta→done 事件序列正确 ② conversation.ts: 存储/读取/修剪消息历史 |
| **测试方案** | `tests/assistant/stream.test.ts` / `tests/assistant/conversation.test.ts` |
| **预期测试结果** | 流事件时序正确 / 历史管理无丢失 |

---

## C-004 模块 C 单元测试

### 文件 13-20：8 个测试文件

| 文件 | 覆盖 | 预估用例 |
|------|------|----------|
| `tests/mistakes/mistakes-api.test.ts` | 错题 CRUD 4 端点 + 筛选/分页 | ~15 |
| `tests/mistakes/review-tracker.test.ts` | 艾宾浩斯间隔计算 + 到期检测 | ~10 |
| `tests/graph/builder.test.ts` | 图谱构建 + 掌握度 | ~12 |
| `tests/graph/mastery.test.ts` | 掌握度计算 + 边界 | ~8 |
| `tests/graph/highlight.test.ts` | 薄弱点标记 + 推荐 | ~6 |
| `tests/assistant/context-injector.test.ts` | 上下文注入 | ~10 |
| `tests/assistant/conversation.test.ts` | 对话历史管理 | ~8 |
| `tests/assistant/assistant-api.test.ts` | 流式响应 + 错误处理 | ~6 |

---

## C-005 Phase 3 优化（后续，暂不实现）

| 优化编号 | 文件 | 简述 |
|----------|------|------|
| O-003 | `app/api/sky/recommend/route.ts` | 基于错题的个性化练习题推荐 |
| O-004 | `lib/ai/agent-memory.ts` | AI 助教记忆（短期+长期） |
| O-006 | `lib/schedule/review-scheduler.ts` | 艾宾浩斯复习计划自动推送 |
| O-010 | `components/ai/global-ai-panel.tsx` | AI 全局悬浮+快捷键+选中文字提问 |

---

## 总文件目录

```
app/api/sky/
  mistakes/route.ts          # 重写 → C-001
  knowledge-graph/route.ts   # 重写 → C-002
  assistant/route.ts          # 修改 → C-003（已有）

lib/
  mistakes/
    mistake-types.ts          # 新建 → C-001
    review-tracker.ts         # 新建 → C-001
  graph/
    types.ts                  # 新建 → C-002
    builder.ts                # 新建 → C-002
    mastery.ts                # 新建 → C-002
    highlight.ts              # 新建 → C-002
  assistant/
    context-injector.ts       # 新建 → C-003
    stream.ts                 # 新建 → C-003
    conversation.ts           # 新建 → C-003

tests/
  mistakes/
    mistakes-api.test.ts      # 新建 → C-004
    review-tracker.test.ts    # 新建 → C-004
  graph/
    builder.test.ts           # 新建 → C-004
    mastery.test.ts           # 新建 → C-004
    highlight.test.ts         # 新建 → C-004
  assistant/
    context-injector.test.ts  # 新建 → C-004
    conversation.test.ts      # 新建 → C-004
    assistant-api.test.ts     # 新建 → C-004
```

**修改 3 个 / 新建 17 个 / 总计 20 个文件**

---

## O-009 虚拟形象创建 计划（预览，不实现）

| 项 | 内容 |
|----|------|
| **归属** | 队员2 B-007 Phase 3 优化 |
| **目标** | 用户自定义虚拟形象：头像上传/AI 生成/预设选择 |
| **产出** | `components/sky/slides/avatar-selector.tsx` 扩展到全局 / `components/avatar-creator.tsx` AI 生成 / `lib/store/user-profile.ts` 头像字段 |
| **与 Module C 的联系** | 头像数据存入 UserProfile Store → AI 助手可读取用户头像信息 → 全局 UI 统一展示 |
| **备注** | 这是队员2 的任务，如果你要做，需要确认队员2 没在同时做 |
