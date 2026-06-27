# 天空课堂 (Sky Classroom) 项目文档

## 文档结构

```
docs/
├── README.md                          # 文档索引（本文件）
│
├── features/                          # 功能设计文档
│   ├── core/                          # 核心架构与参考
│   │   ├── sky-classroom-design.md    #   系统架构设计总览
│   │   ├── api-reference.md           #   API 接口参考文档
│   │   ├── types-reference.md         #   TypeScript 类型定义参考
│   │   └── performance-optimization-plan.md  # 性能优化计划
│   │
│   ├── ppt/                           # PPT 生成模块
│   │   ├── ppt-agent-architecture.md          # PPT Agent 架构设计
│   │   ├── ppt-generation-pipeline-plan.md    # PPT 生成管线设计
│   │   ├── ppt-split-generation-plan.md       # PPT 分步生成方案
│   │   ├── ppt-content-quality-plan.md        # PPT 内容质量优化
│   │   ├── template-analysis-and-generation-plan.md  # 模板分析与生成
│   │   └── Lottie动画虚拟形象-讲课页面集成方案.docx  # 虚拟形象集成方案
│   │
│   ├── slides/                        # 幻灯片模块
│   │   ├── plan-slides-module.md      #   幻灯片模块重构规划
│   │   └── log-slides-module.md       #   幻灯片模块开发日志
│   │
│   └── solve-engine/                  # 解题引擎
│       ├── specs                      #   设计规格文档
│       ├── plans                      #   实施计划文档
│       └── refactor                   #   重构日志与规划
│
├── reports/                           # 项目阶段报告
│   ├── phase1-report.md               # Phase 1 验收报告：核心引擎验证
│   ├── phase2-report.md               # Phase 2 验收报告：引擎完善
│   ├── phase3-plan.md                 # Phase 3 开发计划
│   ├── phase3-plan.docx               # Phase 3 开发计划（Word版）
│   ├── phase3-report.md               # Phase 3 验收报告：前后端集成
│   └── phase4-report.md               # Phase 4 验收报告：完整映射+上线
│
└── testing/                           # 测试相关
    ├── testing-guide.md               # 性能优化测试指南
    └── problem.txt                    # 已知问题清单
```

## 文档用途速查

| 我想了解... | 去哪看 |
|-------------|--------|
| 系统整体架构 | `features/core/sky-classroom-design.md` |
| API 接口怎么调 | `features/core/api-reference.md` |
| TypeScript 类型定义 | `features/core/types-reference.md` |
| PPT 怎么生成的 | `features/ppt/ppt-generation-pipeline-plan.md` |
| PPT Agent 架构 | `features/ppt/ppt-agent-architecture.md` |
| 幻灯片模块怎么做 | `features/slides/plan-slides-module.md` |
| 解题引擎设计 | `features/solve-engine/specs` |
| 各阶段做了什么 | `reports/phase{1-4}-report.md` |
| 性能优化方案 | `features/core/performance-optimization-plan.md` |
| 怎么跑测试 | `testing/testing-guide.md` |
| 有哪些已知问题 | `testing/problem.txt` |
| 云端智囊工具个性化教学方案 | `cloud-mind-personalized-tools-plan.md` |
| 云端智囊个性化工具实施记录 | `cloud-mind-personalized-tools-implementation.md` |

## 文档命名规范

- **报告**: `phase{N}-report.md` — 各阶段验收报告
- **规划**: `*-plan.md` — 功能开发计划
- **设计**: `*-design.md` — 技术设计规格
- **日志**: `log-*.md` — 开发过程记录

---

*天空课堂项目文档 · 更新于 2026-05-28*
