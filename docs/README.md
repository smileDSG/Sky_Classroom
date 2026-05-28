# 天空课堂 (Sky Classroom) 项目文档

## 文档结构

```
docs/
├── README.md                    # 文档索引（本文件）
├── api-reference.md             # API 接口参考文档
├── types-reference.md           # TypeScript 类型定义参考
├── testing-guide.md             # 测试指南
├── sky-classroom-design.md      # 系统架构设计文档
├── phase1-report.md             # Phase 1 项目报告
├── phase2-report.md             # Phase 2 项目报告
├── phase3-report.md             # Phase 3 项目报告
├── phase4-report.md             # Phase 4 项目报告
├── phase3-plan.md               # Phase 3 项目规划
├── performance-optimization-plan.md  # 性能优化计划
├── log-slides-module.md         # 幻灯片模块开发日志
├── plan-slides-module.md        # 幻灯片模块规划
├── ppt-agent-architecture.md    # PPT Agent 架构设计
├── ppt-content-quality-plan.md  # PPT 内容质量计划
├── ppt-generation-pipeline-plan.md   # PPT 生成管线计划
├── ppt-split-generation-plan.md # PPT 分步生成计划
├── template-analysis-and-generation-plan.md  # 模板分析与生成计划
├── specs/                       # 设计规格文档
│   ├── 2026-05-18-a001-solve-graph-design.md
│   ├── 2026-05-23-avatar-speech-bubble-design.md
│   ├── 2026-05-26-beta-test-system-design.md
│   ├── 2026-05-27-dashboard-ui-redesign-design.md
│   ├── 2026-05-27-homepage-dashboard-redesign-design.md
│   └── 2026-05-27-homepage-intro-sequence-design.md
├── plans/                       # 项目计划文档
│   ├── 2026-05-18-a001-solve-graph.md
│   ├── 2026-05-20-module-a-completion.md
│   ├── 2026-05-23-avatar-speech-bubble-plan.md
│   ├── 2026-05-26-beta-test-system.md
│   ├── 2026-05-27-dashboard-ui-redesign.md
│   ├── 2026-05-27-homepage-dashboard-redesign.md
│   ├── 2026-05-27-homepage-intro-sequence.md
│   └── 2026-05-28-beta-internal-testing.md
├── refactor/                    # 重构计划与日志
│   ├── B-001-幻灯片生成规划.md
│   ├── B-001-幻灯片生成日志.md
│   ├── B-002-虚拟形象讲解规划.md
│   ├── B-002-虚拟形象讲解日志.md
│   ├── B-004-模块B测试规划.md
│   ├── B-004-模块B测试日志.md
│   ├── B-005-幻灯片讲解页UI规划.md
│   ├── B-005-幻灯片讲解页UI日志.md
│   ├── B-006-模块B测试规划.md
│   ├── B-006-模块B测试日志.md
│   └── O-008-PPT导出质量规划.md
└── logs/                        # 测试日志
    └── 2026-05-20-test-log.md
```

## 文档分类说明

### 核心文档

| 文件 | 描述 |
|------|------|
| `README.md` | 文档索引和项目概述 |
| `sky-classroom-design.md` | 系统架构设计总览 |
| `api-reference.md` | 后端 API 接口详细说明 |
| `types-reference.md` | TypeScript 类型定义参考 |
| `testing-guide.md` | 测试策略和指南 |

### 项目阶段报告

| 文件 | 阶段 | 描述 |
|------|------|------|
| `phase1-report.md` | Phase 1 | 项目第一阶段完成报告 |
| `phase2-report.md` | Phase 2 | 项目第二阶段完成报告 |
| `phase3-report.md` | Phase 3 | 项目第三阶段完成报告 |
| `phase4-report.md` | Phase 4 | 项目第四阶段完成报告 |
| `phase3-plan.md` | Phase 3 | 项目第三阶段开发规划 |

### 模块专项文档

| 文件 | 描述 |
|------|------|
| `log-slides-module.md` | 幻灯片模块开发日志 |
| `plan-slides-module.md` | 幻灯片模块开发规划 |
| `ppt-agent-architecture.md` | PPT Agent 架构设计 |
| `ppt-content-quality-plan.md` | PPT 内容质量优化计划 |
| `ppt-generation-pipeline-plan.md` | PPT 生成管线设计 |
| `ppt-split-generation-plan.md` | PPT 分步生成方案 |
| `template-analysis-and-generation-plan.md` | 模板分析与生成计划 |
| `performance-optimization-plan.md` | 性能优化计划 |

### 设计规格 (`specs/`)

详细的功能设计规格文档，包含技术实现细节。

### 项目计划 (`plans/`)

功能开发计划文档，包含需求分析、任务分解和时间预估。

### 重构记录 (`refactor/`)

代码重构和模块优化的规划与执行日志。

### 测试日志 (`logs/`)

测试过程和结果记录。

## 文档规范

### 文件命名规则

- **日期前缀**: `YYYY-MM-DD-` 格式，便于按时间排序
- **类型后缀**: `-design.md` (设计规格), `-plan.md` (计划), `-log.md` (日志), `-report.md` (报告)
- **模块标识**: 使用 `A-xxx`、`B-xxx` 等标识模块

### 文档模板

各类文档应遵循统一的模板结构：

**设计规格文档**:
1. 需求分析
2. 技术方案
3. API 设计
4. 数据模型
5. 流程图

**计划文档**:
1. 目标说明
2. 任务分解
3. 时间预估
4. 资源需求
5. 风险评估

**报告文档**:
1. 完成内容
2. 技术亮点
3. 问题与解决方案
4. 后续计划

## 最近更新

| 文件 | 最后更新 |
|------|----------|
| `phase3-plan.md` | 2026-05-19 |
| `2026-05-28-beta-internal-testing.md` | 2026-05-28 |
| `2026-05-27-dashboard-ui-redesign-design.md` | 2026-05-27 |

---

*天空课堂项目文档 · 更新于 2026-05-28*
