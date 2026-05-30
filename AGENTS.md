# OpenMAIC Agent 框架规范

## 核心原则

### 1. 禁止降级 Fallback

> **Agent 框架最忌讳降级 fallback。**
>
> 降级 fallback（如用占位符、默认内容、简单文字替换失败的页面）会严重损害用户体验，且问题被掩盖后难以排查。

- **要么重试**：在合理的 timeout 和重试次数内不断尝试，直到成功。
- **要么报错**：如果重试耗尽仍失败，必须将错误清晰地暴露给用户，说明哪个阶段、哪个环节失败，而不是用 fallback 糊弄过去。
- **例外**：只有明确被定义为"可选增强"的功能（如 QA 的 visual layer、preview PNG 生成）才允许降级跳过，且降级行为必须被记录到日志中。

### 2. 阶段边界清晰

每个 Agent 必须有明确的输入契约（Input Contract）和输出契约（Output Contract）。跨阶段传递的数据必须通过严格的 Schema 校验，不允许"静默忽略"或"宽松解析"。

### 3. 内部健壮性

每个 Agent 内部必须具备：
- 输入校验（Validate Input）
- 输出校验（Validate Output）
- 错误分类（区分可重试错误 vs 不可重试错误）
- 详细的日志记录（记录每一步的决策依据）

---

## 阶段定义

### Planning Agent
- **职责**：决定 PPT 的结构——章节划分、每章页数、每页类型、每页标题和内容大纲。
- **输入**：topic, difficulty, minPages, maxPages, designDNA
- **输出**：`Outline`（符合 `outlineSchema`）
- **失败策略**：重试 3 次（timeout 180s）。若仍失败，直接报错，pipeline 终止。

### Section Agent
- **职责**：为每页生成完整的业务内容 JSON，不涉及视觉布局。
- **输入**：`SectionPlan`（来自 Planning 的一章）
- **输出**：`SectionOutput`（符合 `sectionOutputSchema` + per-type content schema）
- **失败策略**：重试 3 次（timeout 90s）。若仍失败，直接报错，pipeline 终止。

### Page Design Agent
- **职责**：将 content 数据 + DesignDNA 转换为渲染指令序列。零内容创作，纯视觉编排。
- **输入**：pageNum, pageType, content, totalPages, designDNA
- **输出**：`PageInstructions`（符合 `pageInstructionsSchema`）
- **失败策略**：重试 3 次（timeout 180s）。若仍失败，直接报错，pipeline 终止。

### QA Agent
- **职责**：质检。Layer 1（结构检查，代码级），Layer 2（内容质量，LLM）。
- **输入**：outline, allContent, allPages, languageModel
- **输出**：`QAReport`
- **失败策略**：Layer 2（内容 QA）失败可降级为仅 Layer 1 结果，但必须记录日志。

---

## 错误处理策略

| 错误类型 | 示例 | 处理方式 |
|---------|------|---------|
| 可重试错误 | API timeout、网络抖动、rate limit | 指数退避重试，直到成功或重试耗尽 |
| 不可重试错误 | Schema 校验失败、JSON 解析失败、逻辑错误 | 立即报错，不降级 |
| 可跳过错误 | Preview PNG 生成失败、非关键 QA layer | 记录日志，降级跳过 |

---

## API Key Pool 负载均衡

当单个 provider（如 DeepSeek）拥有多个 API key 时，使用 Key Pool 实现负载均衡，提升并发吞吐和故障容错。

### 机制
- **选 key 策略**：Least-inflight（最少并发中）+ Round-robin 平局打破
- **失败隔离**：单个 key 连续失败 3 次后标记为 unhealthy，1 分钟后自动恢复
- **零 racing**：每个请求只使用 1 个 key（成本 ×1），不并行试探多个 key

### 配置方式
环境变量（优先级最高）：
```bash
# 单 key（向后兼容）
DEEPSEEK_API_KEY=sk-xxx

# 多 key 池（逗号分隔，启用负载均衡）
DEEPSEEK_API_KEYS=sk-aaa,sk-bbb,sk-ccc
```

YAML 配置也支持 `apiKeys` 数组字段。

### 代码集成
- `lib/ai/key-pool.ts` — KeyPool 实现
- `lib/ai/providers.ts` — fetch wrapper 中动态替换 Authorization header
- `lib/server/provider-config.ts` — `resolveApiKeys()` 解析多 key 来源

---

## 数据契约

每个阶段之间的数据传递必须通过 Zod Schema 严格校验。Schema 变更必须同步更新所有相关 Agent 的 prompt 和校验逻辑。

详见各阶段源码中的 `*_schema` 定义。

---

## 开发协作规范（借鉴 Superpowers）

本规范适用于所有对 PPT 生成模块（`lib/slides/agent/`、`lib/slides/template-packs/`、`lib/export/`、`packages/pptxgenjs/`）的代码修改。

### 1. 计划先行

任何涉及 **3 个以上文件修改** 或 **新增超过 100 行代码** 的功能，必须先写实施计划：

- **任务粒度**：每个任务控制在 2-5 分钟完成，对应一次独立的代码变更
- **文件映射**：明确列出每个任务要创建/修改的文件及具体行号范围
- **验证方式**：每个任务必须有明确的验证手段（测试通过 / 编译通过 / 手动验证步骤）
- **保存位置**：计划文档保存在 `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

> **反模式**：直接开写代码，想到哪改到哪，最后发现破坏了其他模块的契约。

### 2. TDD（测试驱动开发）

**铁律：没有失败的测试，就不写生产代码。**

| 场景 | 流程 |
|------|------|
| 新功能 | 写测试 → 运行确认失败（RED）→ 写最小实现 → 运行确认通过（GREEN）→ 重构 |
| Bug 修复 | 写复现测试 → 确认失败 → 修复 → 确认通过 |
| 重构 | 确保现有测试全绿 → 重构 → 仍全绿 |

- 测试失败时必须亲眼看到失败信息，确认它失败的原因与预期一致
- 实现代码必须是最小的、刚好让测试通过的代码
- 已经写了实现代码但没写测试？**删掉它，重新开始**

### 3. 子代理审查（两阶段）

复杂任务（涉及 2+ 个 Agent 文件或核心算法变更）完成后，必须进行两阶段审查：

**阶段一：Spec Compliance 审查**
- 代码是否实现了计划中的所有要求？
- 是否有遗漏的功能点？
- 文件结构是否符合设计？

**阶段二：Code Quality 审查**
- 是否有重复代码？（DRY）
- 命名是否清晰、一致？
- 边界情况和错误处理是否到位？
- 是否引入了不必要的复杂度？（YAGNI）

> 审查不通过 → 修复 → 重新审查。不允许"差不多就行"。

### 4. 系统调试流程

遇到 bug 时，禁止凭感觉修。遵循以下流程：

1. **复现**：确保能 100% 复现问题，记录最小复现步骤
2. **假设**：基于证据提出 1-3 个最可能的根因假设
3. **实验**：设计实验验证每个假设（日志、断点、单元测试）
4. **验证**：确认修复后问题消失，且未引入回归

> **反模式**：看到报错直接改代码，改完"应该好了"，不验证就提交。

### 5. 提交规范

- **原子提交**：每个 commit 对应一个独立的逻辑变更，不混无关修改
- **提交信息格式**：`<type>: <description>`
  - `feat:` 新功能
  - `fix:` Bug 修复
  - `refactor:` 重构（无行为变更）
  - `test:` 测试相关
  - `docs:` 文档更新
- **必须包含**：做了什么 + 为什么做（对于非显而易见的变更）

---

## Skill 使用速查

| 场景 | 触发 Skill |
|------|-----------|
| 开始新功能开发 | `brainstorming` → `writing-plans` → `subagent-driven-development` |
| 修复 Bug | `systematic-debugging` → `test-driven-development` |
| 代码重构 | `test-driven-development`（确保测试基线）→ `requesting-code-review` |
| 复杂任务完成后 | `requesting-code-review`（两阶段审查） |
| 分支收尾 | `finishing-a-development-branch` |

> 以上 Skill 为 Superpowers 方法论参考，实际执行时由开发者在 Kimi Code CLI 中手动遵循对应流程。
