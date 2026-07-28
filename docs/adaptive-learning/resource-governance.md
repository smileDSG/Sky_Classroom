# 高考数学资源治理与发布

本文说明高考数学自适应学习资源从人工复核到运行时查询的唯一发布流程。核心原则是：**固定索引、仅 verified、失败即报错、绝不降级 fallback**。

## 运行时不变量

- 运行时只读取固定索引 `data/adaptive-learning/gaokao-math/resource-index.v1.json`，不直接读取 `data/crawled/math`、人工清单或旧存储。
- API 只返回 `status: verified` 的资源。`needs-review` 与 `rejected` 永不进入教学结果。
- 查询条件只会收窄候选集：不得为凑数量而放宽知识点、资源类型、难度、学科或阶段，也不得跨节点、跨学科或回查旧存储。
- 没有符合条件的 verified 资源时返回 `RESOURCE_GAP`；索引无法读取、校验或发布时返回 `RESOURCE_INDEX_UNAVAILABLE`。两者不可互相替代。
- 运行时索引必须匹配课程包 `gaokao-math-2026.1`。版本不一致必须报错并重新构建，不能继续使用不匹配数据。

## 三类版本化文件

| 文件 | 角色 | 编辑规则 |
| --- | --- | --- |
| `manual-verification.v1.json` | 人工治理输入，记录 verified/rejected 决策、节点、类型、难度、审核人和审核时间 | 只在完成真实人工复核后修改，并接受代码审查 |
| `resource-index.v1.json` | 运行时唯一资源索引，包含严格校验后的资源记录 | 构建生成，禁止手工修改 |
| `governance-report.v1.json` | 构建诊断报告，汇总状态、原因、解析失败和资源缺口 | 构建生成，禁止手工修改；不得作为运行时数据源 |

V1 构建输入固定为 `data/crawled/math` 下的 915 个 Markdown 文件。目录数量或内容发生变化时，必须作为一次显式治理变更审查，不能顺带混入发布。

## V1 基线

- 课程包：`gaokao-math-2026.1`
- 索引版本：`2026-07-28.1`
- 扫描/解析：915 / 915
- 状态：verified 6、needs-review 884、rejected 25
- 六个已知缺口：函数性质（`functions-properties`）、不等式（`inequalities`）、统计（`statistics`）、解析几何（`analytic-geometry`）、立体几何（`solid-geometry`）、复数（`complex-numbers`）

基线不是“必须永远不变”的数字，而是 V1 的审计锚点。任何变化都应能由人工清单、抓取输入或构建版本变化解释。

## 状态规则

- `verified`：必须来自人工清单中的 verified 决策，包含合法 `nodeIds`、`resourceType`、`difficulty`、`reviewer` 与 `reviewedAt`，且不能是硬重复。只有此状态可被运行时查询。
- `needs-review`：未完成明确人工决策，或存在歧义映射、软重复等待复核原因。不得自动升级为 verified。
- `rejected`：人工拒绝或被判定为硬重复，必须保留拒绝原因。硬重复不能通过人工清单强行改成 verified。

## 复核与发布步骤

1. 确认构建输入仍为数学目录且数量符合本次预期：

   ```powershell
   (rg --files data/crawled/math -g '*.md' | Measure-Object).Count
   ```

2. 逐条核对来源、正文、知识点映射、资源类型和难度，只把完成复核的决定写入 `manual-verification.v1.json`。不要通过扩大节点或学科范围来消除缺口。
3. 在 `package.json` 的 `adaptive:resources` 脚本中同时更新 `--index-version` 与 `--generated-at`。`generated-at` 是显式构建输入，不应在脚本内取当前时间。
4. 构建索引与报告：

   ```powershell
   npm run adaptive:resources
   ```

   该脚本使用 `tsx --conditions=react-server`，用于正确加载带 `server-only` 边界的模块；不要移除此条件。

5. 检查状态计数、原因计数、解析失败和六类缺口是否符合本次变更预期，并审查全部产物差异：

   ```powershell
   git diff -- data/adaptive-learning/gaokao-math/manual-verification.v1.json data/adaptive-learning/gaokao-math/resource-index.v1.json data/adaptive-learning/gaokao-math/governance-report.v1.json
   ```

6. 运行资源链路的定向测试（含构建集成与 API）：

   ```powershell
   npm test -- tests/adaptive-learning/crawled-document.test.ts tests/adaptive-learning/resource-mapping.test.ts tests/adaptive-learning/resource-governance.test.ts tests/adaptive-learning/resource-index-builder.test.ts tests/adaptive-learning/resource-index-cli.test.ts tests/adaptive-learning/resource-repository.test.ts tests/api/math-resources.test.ts
   ```

7. 合入前运行完整验证：

   ```powershell
   npm test
   npm run lint
   npm run build
   ```

任一步失败都应停止发布并修复根因，不得保留占位索引、空结果或旧存储 fallback。

## 可复现性

构建会稳定排序并使用显式的 `index-version` 与 `generated-at`。源文件、人工清单、课程包、代码和这两个参数完全相同时，生成的索引与报告必须逐字节一致。

可连续构建两次并比较 SHA-256；`Compare-Object` 无输出即一致：

```powershell
$files = @(
  'data/adaptive-learning/gaokao-math/resource-index.v1.json',
  'data/adaptive-learning/gaokao-math/governance-report.v1.json'
)
npm run adaptive:resources
$first = $files | Get-FileHash -Algorithm SHA256
npm run adaptive:resources
$second = $files | Get-FileHash -Algorithm SHA256
Compare-Object $first $second -Property Path, Hash
git diff -- $files
```

## 发布原子性与恢复

构建器先写临时 report 和 index，再备份现有文件，随后先发布 report、最后发布 index。**index 的最后一次重命名是运行时提交点**：report 只是诊断信息，在新 index 成功发布前，运行时仍应看到旧 index。

发布中断时，构建器会删除已发布的新文件并从备份恢复旧文件；临时文件会被清理。若回滚或备份清理也失败，错误详情会列出恢复备份路径，运维人员必须保留并检查这些备份，不能用半成品或空文件顶替。即使 report 已生成，也不能据此假定新 index 已上线。

## 故障判定

| 现象/错误 | 含义 | 处理 |
| --- | --- | --- |
| `INVALID_SCHEMA` | 抓取文档、人工清单、CLI 参数或生成数据不符合严格契约 | 修正输入后重建；不发布任何替代内容 |
| `RESOURCE_GAP`（API 404） | 索引可用，但筛选后没有 verified 资源 | 增加真实复核资源或接受缺口；不得放宽节点/学科/状态 |
| `RESOURCE_INDEX_UNAVAILABLE`（API 503） | 索引读取、校验、写入、回滚或备份清理失败 | 检查错误日志与备份路径，恢复一致产物后重建；不得回查旧存储 |
| `CURRICULUM_VERSION_MISMATCH`（API 409） | 索引课程包与运行时期望不一致 | 更新包/清单/版本参数并完整重建 |
| 资源停留在 `needs-review` | 尚无足够人工证据或存在歧义/软重复 | 完成人工复核；不得自动提升 |
| 资源为 `rejected` | 人工拒绝或硬重复 | 保留原因；新增合格来源，而不是强制验证原记录 |
| 测试、lint 或 build 失败 | 发布质量门未通过 | 停止提交生成产物，修复并从构建步骤重新验证 |

治理目标不是“总能返回内容”，而是确保每次返回都来自可追溯、版本一致且人工验证的高考数学资源。
