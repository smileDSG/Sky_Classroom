---
name: openmaic-dev
description: OpenMAIC 项目模块开发规范。当用户在 OpenMAIC 项目中进行模块开发、代码重构、测试编写时使用。触发条件：用户提到"开发规范"、"按流程来"、"B-00X"等任务编号，或在 OpenMAIC 项目目录下进行开发工作。
---

# OpenMAIC 模块开发规范

## 六步开发流程

每个模块严格按以下顺序执行：

### 1. 定规划
- 启动 Plan mode，探索代码库
- 写方案文件（涉及文件、架构设计、步骤、验证方式）
- 用户审批后开始编码

### 2. 按规划执行
- 先核心模块，再 barrel export，再 API 接驳，再 Store，最后测试
- 每个 Step 有明确产出文件

### 3. 写自动化测试
- **依赖注入模式**：mock 通过参数传入（如 `AICallFn`、`TTSGenerateFn`），不 `vi.mock()` 模块
- 覆盖：正常路径 + 边界情况 + 错误处理 + prompt 完整性
- 隔离模式下全部通过后跑全量确认无回归

### 4. 前后端联调验收提醒
- 代码写完、测试通过后，主动提醒用户验收
- 提供 API 调用示例（curl 命令）或浏览器测试链接
- 前端 UI 就绪时提醒用户手动测试流程

### 5. 用户确认完成
- 用户说"完成"/"没问题"之后才算完成

### 6. 同步文档
- 更新 `docs/refactor-plans/` 对应日志文件（规划.md + 日志.md）
- 标记验收检查清单
- 提交代码

## 架构原则

### 数据归属 — 单一写入入口
- 每个数据域只有一个模块负责写入
- 例如：`lib/slides/` 的 slide 数据由 `slide-generator.ts` 产出，其他地方只读

### 跨模块走接口 — 不直接穿透
- API route 不直接调用 prompt builder、LLM，通过 `lib/` 封装好的函数
- 跨模块依赖通过类型注入传递（`AICallFn`、`TTSGenerateFn`），不硬编码具体实现

### 依赖方向 — 单向无循环
```
API Route → lib 模块 → prompt template / LLM
```
库函数不依赖 API 层、不依赖 Store

### 具体类不泄露 — 依赖注入
- 核心函数接受注入参数，不直接 `import` 具体实现
- 测试直接用回调注入 mock，不 `vi.mock()` 模块

### 反模式禁止
- API route 不写业务逻辑（薄层，只做校验+调用+返回）
- 不重复已有代码（优先复用现有管线）
- 不跳过规划直接写代码
- 测试未通过不提交
- 用户未验收不标记完成
- 不忘记同步文档

## 编码规范

| 规范 | 示例 |
|------|------|
| Logger | `const log = createLogger('ModuleName')` |
| API 响应 | `apiSuccess(data)` / `apiError(code, status, msg)` |
| 提示词 | `buildPrompt(PROMPT_IDS.XXX_V2, vars)` |
| 类型 | 所有函数有显式返回类型 |
| Barrel | 每个模块 `index.ts` 统一导出 |
