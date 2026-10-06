# 动画讲解（Animation Explainer）设计

- 日期：2026-10-04
- 状态：已与用户确认
- 产品形态：独立入口（`/sky/animation`）
- 参考灵感：FogSight（雾象）——输入抽象概念，生成带旁白的叙事动画

## 1. 背景与目标

数据结构、算法、数学、物理等可结构化内容，纯文字难以理解，配合"元素移动、变换、高亮"的动画讲解可以显著降低理解成本。本功能让用户输入一个话题（如"二叉堆的插入与上浮"），系统自动生成一段**分步动画讲解**：SVG 舞台上图元按讲解节奏移动/出现/消失，AI 旁白（TTS）与动画同步。

**成功标准：**

- 用户输入可结构化话题后，一键生成可播放、可单步回溯的动画讲解。
- 生成结果质量稳定（schema 校验 + 修复兜底），无白屏/无法播放的产出。
- 播放支持顺播、暂停、单步前进/后退、进度条跳转、倍速。

## 2. 范围定位（已确认的决策）

| 决策点 | 结论 |
| --- | --- |
| 产品形态 | 独立入口，不改动现有课堂生成管线（后续可复用底层能力接入课堂） |
| 内容范围 | 聚焦可结构化学科：算法、数据结构、数学、物理 |
| 播放体验 | 顺播 + 单步回溯（支持进度条跳转与倍速） |
| 技术路线 | 声明式分镜 DSL + 自研 SVG/motion 渲染器（非 LLM 生成 HTML） |

**为何不用 LLM 生成 HTML（interactive widget 通道）**：iframe 内部状态不可逆推，无法做单步回溯与进度条跳转；质量只能靠表面审计，波动大。声明式 DSL 的状态是"步骤的纯函数"，回溯/跳转天然免费，且 schema 可严格校验、可单测、可自动修复。

**明确不做（v1）**：通用任意概念的叙事动画；用户改参数重跑；导出视频；嵌入课堂场景。DSL 预留演进空间（见 §9）。

## 3. DSL 数据模型

生成产物是一份 `AnimationScript`（JSON，严格 Zod 校验）：

```ts
AnimationScript {
  id, title, topic
  subjectArea: 'algorithm' | 'data-structure' | 'math' | 'physics'
  stage: { width, height, showGrid?, showAxes? }   // SVG viewBox，逻辑坐标系
  actors: Actor[]        // 舞台上的"演员"（图元），全局声明一次
  steps: Step[]          // 分步快照，5~20 步
}
```

### 3.1 演员类型（v1 共 8 种，全部为声明式数据，无逻辑）

```ts
Actor =
  | { kind: 'node',       id, label, shape: 'circle'|'rect', color, r | w, h }
  | { kind: 'array-cell', id, label, w, h, color }   // 数组格子，位置由状态给
  | { kind: 'arrow',      id, fromActorId, toActorId, label?, curved? }
  | { kind: 'pointer',    id, label, targetActorId } // "i"/"pivot" 等指针
  | { kind: 'text',       id, content, size, color }
  | { kind: 'highlight',  id, targetActorId, color } // 高亮框/脉冲
  | { kind: 'bar',        id, label, w, color }      // 柱状（排序/直方图）
  | { kind: 'axes',       id, xmin, xmax, ymin, ymax } // 坐标轴（数学/物理）
```

### 3.2 步骤与状态

```ts
Step = {
  id, title
  narration: string         // 该步旁白 → TTS；音频时长即该步停留时长
  actorStates: ActorState[] // 该步全部可见演员的完整状态
}
ActorState = { actorId, x, y, opacity?, scale?, labelOverride?, colorOverride?, entering?, exiting? }
```

**关键取舍——全量快照而非增量 diff**：每一步列出所有可见演员的完整状态。理由：

- 鲁棒：LLM 漏写某演员不会产生残留错误状态；
- 回溯/跳转免费：任意一步的状态直接可取；
- 渲染纯函数化，可单测。

代价是 token 略多，20 步 × 15 演员的量级可接受。`entering/exiting` 标记驱动入场/出场动画。

**箭头跟随**：`arrow` 只声明 `fromActorId/toActorId`，端点由渲染器从两演员当前状态实时计算——节点移动时箭头自动跟随。

## 4. 渲染器（`components/animation/renderer/`）

- `AnimationCanvas`：一个 SVG 视口（viewBox = stage 尺寸），铺满播放页主区域。
- 每种 Actor 一个子渲染组件（`NodeActor`、`CellActor`、`ArrowActor`…），内部用 **motion/react** 的 `animate` prop 对 x/y/color/scale 自动补间，不手写动画循环。
- 步切换：`entering` 演员做 fade/scale-in，`exiting` 做淡出，其余平滑移动（约 700ms 弹簧曲线）。
- 高亮演员用描边脉冲；箭头可选 `curved`。
- 复用现有依赖：`motion`（已在栈内）、SVG 原生能力；**不新增动画库**。

## 5. 播放器（`components/animation/player/` + `lib/animation/playback/`）

`useAnimationPlayer` hook 管理状态机 `idle → playing ⇄ paused`：

- **顺播**：第 N 步状态先动画过渡（~700ms），同时开始播第 N 步旁白 TTS；音频结束即推进到 N+1。步时长由旁白音频驱动（与现有课堂 playback 的 speech 模式同思路）。
- **控制条**：播放/暂停、上一步/下一步、进度条（按步数刻度，可拖到任意步）、倍速（0.75/1/1.25/1.5）。
- **字幕条**：底部显示当前步 narration。
- **TTS 容错**：音频失败回退到"阅读时长估算"（CJK/Latin 字符速率）；该逻辑现有 playback 已有，抽成共用工具复用。
- **不复用课堂 PlaybackEngine**：它与场景/actions/多智能体耦合过深；新播放核心是轻量 hook（约 200 行），但 TTS 播放、时长估算等工具函数复用。

## 6. 生成管线（`lib/animation/generate/`）

照搬 slides 管线的"规划 → 生成 → 校验修复"模式，两段式：

1. **Plan Agent**（`plan-agent.ts`）：用户话题 → 讲解大纲。输出 5~20 步的分步讲解计划，每步含教学意图（如"展示 pivot 的选择"）与涉及演员的布局草案。prompt：`lib/prompts/animation/plan.md`。
2. **Script Agent**（`script-agent.ts`）：大纲 → 完整 `AnimationScript`。prompt：`lib/prompts/animation/script.md`，内嵌图元用法说明与坐标系规范（如"舞台 1200×675，数组从 x=200 起，每格宽 90"）。输出过严格 Zod schema，失败走 autoFix + 重试。

**校验与修复**（`lib/animation/validate.ts`，0-LLM 结构校验）：

- 引用完整性：`actorStates.actorId` 必须存在于 `actors`；箭头两端演员存在。
- 几何边界：坐标/尺寸在 stage 范围内；格子间不重叠（容差内警告）。
- 布局合理性：相邻步之间演员位移过大时警告（提示用中间步过渡）。
- autoFix 策略：越界坐标 clamp、超长 label 截断、未知演员状态剔除——能修的静默修，修不了的上抛给 Script Agent 重试（3 次指数退避，fail hard，与 slides agent 一致）。

LLM 调用走现有 `lib/ai` 的 provider 抽象 + key pool + 成本统计，不新开通道。

## 7. 入口与页面流

- **入口**：sky 首页 `quick-access-grid` 加"动画讲解"卡片 → `/sky/animation`。
- **生成页**（`app/sky/animation/page.tsx`）：话题输入框 + 示例 chips（"二叉堆的插入与上浮"、"快速排序的 partition"、"梯度下降为什么能收敛"、"单摆的运动"）+ 历史记录列表。
- **生成过程**：提交后走后台 job（`app/api/animation/generate/route.ts`，复用现有后台任务 + `background-tasks-indicator` 模式），页面展示阶段化进度（规划中 → 编写分镜 → 校验修复 → 完成）。
- **播放页**（`app/sky/animation/[scriptId]/page.tsx`）：`AnimationCanvas` + 播放控制条 + 字幕条；脚本持久化存 DB（复用现有 db/API 模式），可重访。

## 8. 错误处理与测试

### 8.1 错误处理

- 生成失败：明确失败态 + 重试按钮，job 状态携带原因摘要。
- Schema 校验彻底失败：降级——若 plan 成功而 script 失败，展示大纲文字版（给出讲解思路，不白屏）。
- 播放页加载不存在的 scriptId：404 处理。

### 8.2 测试策略

- **单测**（`tests/animation/`）：Zod schema 合法/非法 fixture；`validate.ts` 各规则；插值与箭头端点计算纯函数；player 状态机（前进/回溯/跳转）。
- **组件测试**：`AnimationCanvas` 对固定 fixture 渲染出预期演员数量/位置（jsdom + vitest，与现有测试环境一致）。
- **Eval 测试**（复用 `vitest.eval.config.ts` 模式）：真实 LLM 对 3 个代表主题生成 script，断言校验通过率 ≥ 阈值——防止 prompt 退化的回归网。

## 9. 目录结构

```
lib/animation/
  types.ts            # DSL TypeScript 类型
  schema.ts           # Zod + autoFix
  validate.ts         # 引用/几何校验
  interpolate.ts      # 步间插值、箭头端点（纯函数）
  generate/plan-agent.ts · script-agent.ts · pipeline.ts
  playback/player.ts  # 播放核心逻辑（可测）
lib/prompts/animation/plan.md · script.md
components/animation/renderer/…  player/…
app/sky/animation/page.tsx · [scriptId]/page.tsx
app/api/animation/generate/route.ts
tests/animation/…
```

## 10. 实现期偏差备注

- **Prompt 路径**：§9 原拟 `lib/prompts/animation/plan.md · script.md`；实现遵循仓库 loader 的既定约定，落在 `lib/prompts/generators/animation-plan.md · animation-script.md`（PromptId 联合类型注册）。
- **持久化**：§7 所述"存 DB"按 slides job 的文件式持久化模式实现（`data/animation-jobs/`、`data/animation-scripts/`，原子写），未新增 SQL 迁移。
- **播放核心**：§5 的"播放核心逻辑"实现为 `lib/animation/playback/player-machine.ts`（纯 reducer）+ `duration.ts`（时长估算）+ `speech.ts`（TTS 适配器），UI hook 为 `components/animation/player/use-animation-player.ts`。
- **API 鉴权**：实现期审查发现 4 个 /api/animation 路由缺少与兄弟路由一致的 `requireAuth()`，已补齐。

## 11. 未来演进（不在 v1）

- **课堂接入**：动画讲解作为课堂生成管线中的新场景类型，在课程难点处自动穿插。
- **通用概念**：DSL 演员类型扩展（或预留 `custom` 演员嵌入 LLM 生成的 SVG 片段）以覆盖历史、生物、经济等叙事型内容。
- **参数重跑**：允许用户改输入（换一组数组）重看排序过程。
- **导出**：动画导出为视频/GIF。
