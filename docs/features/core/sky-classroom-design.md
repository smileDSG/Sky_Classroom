# 天空课堂（Sky Classroom）架构设计文档

> 基于 智眸无界 架构能力，AI 驱动的智能教学平台

## 1. 产品概述

天空课堂是一款集成 AI 解题、幻灯片讲解、学习数据管理于一体的智能教学平台。

### 1.1 核心功能

| 模块 | 功能 | 技术栈 |
|------|------|--------|
| **模块 A** | 搜题批改：拍照/语音/文字输入 → 智能解题 → 自动批改 → 四段式输出 | LangGraph StateGraph + LLM |
| **模块 B** | 幻灯片讲解：输入教学主题 → AI 生成幻灯片 → 虚拟形象语音讲解 → PPTX 导出 | AI 生成管线 + TTS |
| **模块 C** | 学习数据：错题本 + 知识图谱 + AI 助手 + 学习统计 | Zustand + IndexedDB + D3.js |

### 1.2 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    App Shell (Next.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  /sky     │  │ /sky/    │  │ /sky/    │  │ /sky/   │ │
│  │  (首页)   │  │ solve    │  │ slides   │  │ learning│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │             │              │      │
├───────┼──────────────┼─────────────┼──────────────┼──────┤
│       │              │             │              │      │
│  ┌────▼─────┐  ┌─────▼────┐  ┌────▼─────┐  ┌────▼────┐ │
│  │Dashboard │  │SolvePage │  │SlideView │  │Mistake  │ │
│  │ 组件     │  │ 组件     │  │ 器       │  │Book     │ │
│  └──────────┘  └─────┬────┘  └────┬─────┘  └────┬────┘ │
│                      │             │              │      │
├──────────────────────┼─────────────┼──────────────┼──────┤
│                      │             │              │      │
│  ┌──────────┐  ┌─────▼────┐  ┌────▼─────┐  ┌────▼────┐ │
│  │State     │  │solve/    │  │slides/   │  │mistakes/│ │
│  │(Zustand) │  │solve-    │  │slide-    │  │tracker  │ │
│  │          │  │graph.ts  │  │generator │  │graph    │ │
│  └──────────┘  └─────┬────┘  └────┬─────┘  └────┬────┘ │
│                      │             │              │      │
├──────────────────────┼─────────────┼──────────────┼──────┤
│                      │             │              │      │
│  ┌───────────────────▼─────────────▼──────────────▼────┐ │
│  │              Shared Infrastructure                  │ │
│  │  lib/ai/ (LLM providers) · lib/recognition/ (OCR)   │ │
│  │  lib/generation/ (JSON repair, quality)             │ │
│  │  lib/store/ (Zustand) · lib/utils/database.ts        │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 2. 模块 A · 搜题批改

### 2.1 架构：LangGraph StateGraph

```
START → checkQuestionBank ──(hit)──→ generateOutput → END
                   │(miss)
                   ▼
              routeToAgent → solveWithAgent → gradeAnswer → generateOutput → END
```

### 2.2 Agent 路由策略

| 路由类型 | 关键词 | 模型 |
|----------|--------|------|
| **science** | 物理、化学、数学、代数、几何、方程 | GLM-4-Plus |
| **humanities** | 语文、历史、文学、分析、论述 | Qwen-Max |
| **universal** | 其他 | DeepSeek-V3 |

路由采用关键词计分（science vs humanities），分数相等时降级为 universal。

### 2.3 数据流

1. 用户输入题目（文字/图片/语音）
2. `checkQuestionBank`: Jaccard 相似度匹配题库，命中则直接返回
3. `routeToAgent`: 根据题目类型选择 Agent
4. `solveWithAgent`: 调用 LLM 生成解题过程和答案
5. `gradeAnswer`: 若用户提供答案，进行批改
6. `generateOutput`: 格式化为四段式输出

### 2.4 关键文件

| 文件 | 职责 |
|------|------|
| `lib/solve/solve-graph.ts` | LangGraph StateGraph 定义 |
| `lib/solve/solver-agent.ts` | Agent 节点实现 + 混合策略 |
| `lib/solve/grader.ts` | LLM 批改 + 规则 fallback |
| `lib/solve/four-part-output.ts` | 四段式输出格式化 |
| `lib/solve/question-bank.ts` | 题库 CRUD + 相似度匹配 |

## 3. 模块 B · 幻灯片讲解

### 3.1 数据流

```
输入主题 → generateSlides(topic) → 幻灯片 JSON
                                         ↓
                              generateAvatarSpeech(slides)
                                         ↓
                               TTS 合成音频 URL
                                         ↓
                           exportCourseToPPTX(config) → .pptx
```

### 3.2 虚拟形象

| ID | 名称 | 人设 | 语音风格 |
|----|------|------|----------|
| `professor` | 严肃教授 | 严谨学术 | 慢速、正式 |
| `senior` | 温柔学姐 | 亲切友好 | 中速、口语化 |
| `scholar` | 幽默学渣 | 轻松幽默 | 快速、接地气 |

### 3.3 PPT 导出

使用 `pptxgenjs` 纯前端导出，内容包含：
- 封面页（课程名称 + 形象头像）
- 目录页（幻灯片列表）
- 幻灯片页（含 TTS 备注）
- 知识点页（知识点总结）
- 封底页（谢谢观看）

## 4. 模块 C · 学习数据

### 4.1 错题本

- **存储**: IndexedDB (`lib/mistakes/db.ts`) + Zustand Store
- **错因分析**: LLM + 规则混合诊断 (`lib/mistakes/cause-analyzer.ts`)
- **错因分类**: `concept-unclear`, `calculation-error`, `misreading`, `method-wrong`, `careless`, `format-error`

### 4.2 知识图谱

- **构建**: 从错题记录中提取知识点节点和边关系
- **节点属性**: `mastery` (0-100), `problemCount`, `mistakeCount`, `reviewCount`
- **边关系**: `prerequisite`, `related`, `extension`
- **薄弱点**: 错误率 > 50% 或 reviewCount 低的知识点
- **路径推荐**: 从薄弱知识点出发，按 prerequisite 关系推荐学习路径

### 4.3 AI 助手

- **入口**: 全局悬浮球 (`assistant-fab.tsx`)
- **面板**: 多轮对话面板 (`assistant-panel.tsx`)
- **配置**: 学科偏好、答题风格、难度等级
- **Agent 模板**: `universalSolver`, `scienceSolver`, `humanitiesSolver`
- **上下文**: 可访问错题本和知识图谱数据

### 4.4 跨模块联动

```
搜题批改 ──(错误)──→ 错题本 ──→ 知识图谱 ──→ 首页仪表盘
                                              ↑
AI 助手 ◄────────(错题/图谱上下文)────────────┘
```

## 5. 状态管理

### 5.1 Zustand Store 结构

```
SkyClassroomStore
├── SolveSlice    — currentSolveState, solveHistory, isSolving
├── SlidesSlice   — slides, selectedAvatarId, generationResult
├── MistakesSlice — mistakes[], knowledgeGraph, activeFilter
└── AssistantSlice — isOpen, subject, style, difficulty
```

持久化字段: `selectedAvatarId`, `generationOptions`, `subject`, `style`, `difficulty`, `mistakes`

## 6. API 路由

所有 API 路由位于 `/api/sky/` 下，详见 [API 参考文档](./api-reference.md)。

## 7. 本地存储

| 数据类型 | 存储方案 |
|----------|----------|
| 用户偏好 | Zustand persist (localStorage) |
| 题库数据 | IndexedDB (Dexie v11) |
| 错题记录 | IndexedDB + Zustand Store |
| 知识图谱 | 内存计算 (从错题记录构建) |
