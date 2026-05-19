# 天空课堂测试指南

## 1. 测试架构

### 1.1 目录结构

```
tests/
├── solve/                          # 模块 A 单元测试
│   ├── solve-graph.test.ts         # StateGraph 节点测试
│   ├── solve-graph-state.test.ts   # 状态注解测试
│   ├── solver-agent.test.ts        # Agent 节点测试
│   ├── solver-prompts.test.ts      # Prompt 构建测试
│   ├── grader.test.ts              # 批改引擎测试
│   ├── four-part-output.test.ts    # 四段式输出测试
│   ├── question-bank.test.ts       # 题库 CRUD 测试
│   └── solve-flow.integration.test.ts  # 解题流程集成
├── slides/                         # 模块 B 单元测试
│   ├── slide-generator.test.ts     # 幻灯片生成测试
│   ├── avatar-speech.test.ts       # 虚拟形象语音测试
│   └── sky-classroom-integration.test.ts
├── mistakes/                       # 模块 C 单元测试
│   ├── mistake-tracker.test.ts     # 错题追踪测试
│   ├── cause-analyzer.test.ts      # 错因分析测试
│   └── knowledge-graph.test.ts     # 知识图谱测试
├── sky/                            # UI 组件测试
│   ├── assistant.test.tsx          # AI 助手测试
│   ├── dashboard.test.tsx          # 首页仪表盘测试
│   ├── learning-stats.test.tsx     # 学习统计测试
│   └── mistake-book.test.tsx       # 错题本测试
├── integration/                    # 跨模块集成测试
│   ├── solve-flow.test.ts          # 解题→批改→错题 全链路
│   ├── slide-flow.test.ts          # 幻灯片→语音→导出 全链路
│   └── cross-module.test.ts        # 模块间联动测试
└── recognition/                    # 识别模块测试
    ├── image-recognizer.test.ts
    └── multi-problem-splitter.test.ts
```

### 1.2 Mock 策略

**LLM 调用**: 使用 `vi.mock('@/lib/ai/llm')` 模拟 `callLLM`，返回预设的 JSON 响应。

**数据库**: 使用 `vi.mock('@/lib/utils/database')` 模拟 Dexie IndexedDB，返回 `vi.fn().mockResolvedValue()`。

**Provider**: 使用 `vi.mock('@/lib/ai/providers')` 模拟 `getModel`，返回 `{ model: {}, modelId, provider }` 结构。

### 1.3 Shared Mock State Pattern

```ts
const mocks = vi.hoisted(() => ({
  llmResult: { text: JSON.stringify({ ... }) },
  llmError: null as Error | null,
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => {
    if (mocks.llmError) throw mocks.llmError;
    return mocks.llmResult;
  }),
}));

beforeEach(() => {
  mocks.llmError = null;
});
```

这种模式允许在测试体内动态设置错误，而不影响 mock 工厂。

## 2. 运行测试

### 2.1 全量测试

```bash
pnpm test
```

### 2.2 模块测试

```bash
pnpm vitest run tests/solve
pnpm vitest run tests/slides
pnpm vitest run tests/mistakes
pnpm vitest run tests/sky
```

### 2.3 集成测试

```bash
pnpm vitest run tests/integration
```

### 2.4 监控模式

```bash
pnpm vitest            # 监听文件变化
pnpm vitest --ui       # 浏览器 UI
```

## 3. 关键测试场景

### 3.1 模块 A — 解题批改

| 场景 | 测试文件 | 验证点 |
|------|----------|--------|
| 题库命中 | `solve-flow.integration.test.ts` | `fromQuestionBank = true`，跳过解题 |
| 新题求解 | `solve-flow.integration.test.ts` | `solution` 非空，`fourPartOutput` 有值 |
| 批改模式 | `solve-flow.integration.test.ts` | `gradeResult` 非空 |
| Agent 路由 | `solve-graph.test.ts` | science/humanities/universal 正确 |
| LLM 失败 | `solver-agent.test.ts` | fallback 到次级 Agent |
| 批改引擎 | `grader.test.ts` | 错因分类正确，分步给分 |
| 四段式 | `four-part-output.test.ts` | 格式完整，bold 标记 |

### 3.2 模块 B — 幻灯片

| 场景 | 测试文件 | 验证点 |
|------|----------|--------|
| 幻灯片生成 | `slide-generator.test.ts` | 返回有效 Slide 数组 |
| 语音合成 | `avatar-speech.test.ts` | 每个 Slide 有对应 script |
| 形象配置 | `avatar-speech.test.ts` | 至少 3 种形象 |
| 全链路 | `integration/slide-flow.test.ts` | topic → slides → speech 完整 |

### 3.3 模块 C — 学习数据

| 场景 | 测试文件 | 验证点 |
|------|----------|--------|
| 错题追踪 | `mistake-tracker.test.ts` | CRUD 操作正常 |
| 错因分析 | `cause-analyzer.test.ts` | 6 种错因正确分类 |
| 知识图谱 | `knowledge-graph.test.ts` | 节点/边/薄弱点正确 |
| 模块联动 | `integration/cross-module.test.ts` | 错题→图谱联动 |

### 3.4 跨模块集成

| 场景 | 测试文件 | 验证点 |
|------|----------|--------|
| 解题→错题 | `integration/solve-flow.test.ts` | 错题可从解题结果创建 |
| 错题→图谱 | `integration/cross-module.test.ts` | 图谱反映错题数据 |
| 图谱→仪表盘 | `integration/cross-module.test.ts` | 薄弱点影响学习统计 |
| AI 助手上下文 | `integration/cross-module.test.ts` | 助手可访问错题/图谱 |

## 4. 测试覆盖率

| 模块 | 测试数 | 覆盖率 |
|------|--------|--------|
| solve | 91+ | > 80% |
| slides | 15+ | > 70% |
| mistakes | 30+ | > 75% |
| integration | 20+ | 全链路 |

## 5. CI 注意事项

- **merge conflicts**: `lib/export/use-export-pptx.ts` 存在 merge conflict marker，会导致 oxc 编译失败
- **mock shape**: `getModel` mock 必须包含 `model: {}` 字段
- **IndexedDB**: 测试环境无浏览器，所有 Dexie 操作必须 mock
- **LLM**: 所有 LLM 调用必须 mock，不发送真实请求
