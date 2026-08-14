# 智眸无界 教学PPT生成链路 — 开发规划文档

> 版本: v1.0
> 日期: 2026-05-24
> 状态: **规划阶段，待确认后执行**
> 技术路线: 模板切片填充（Template Slice Filling）+ python-pptx

---

## 一、项目背景

### 1.1 现状

智眸无界-B-001 现有的PPT生成模块采用 **pptxgenjs 代码生成** 路线：
- AI生成每页的元素坐标、颜色、字体
- 后端用 pptxgenjs 逐元素绘制PPT
- 现有6套主题（sky-blue, minimal, warm, fresh, dark, ocean）

**问题：** 生成的PPT设计感差、布局僵化、与专业设计师作品差距大，无法达到教学课件的生产质量。

### 1.2 新路线决策（已确认）

采用 **"模板切片填充"** 架构：
- 12套专业设计师PPT模板作为基础资产
- AI只生成结构化文本内容（统一JSON Schema）
- 后端将JSON内容填充到模板PPTX的对应文本框中
- 保留旧系统作为Fallback

### 1.3 目标

建设一套 **"输入主题 → AI生成内容 → 选择模板 → 输出专业PPT"** 的完整链路，产出效果接近设计师手工制作。

---

## 二、技术架构

### 2.1 完整数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  前端                                                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ 主题输入框    │───→│ 学科推断+     │───→│ 模板Gallery  │                   │
│  │ (topic输入)   │    │ 默认模板推荐   │    │ (12套缩略图)  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                   │                          │
│                                                   ▼                          │
│                                          ┌──────────────┐                   │
│                                          │ 用户确认模板  │                   │
│                                          │ templateId   │                   │
│                                          └──────────────┘                   │
│                                                   │                          │
└───────────────────────────────────────────────────┼──────────────────────────┘
                                                    │
                    POST /api/sky/slides/generate   │
                    Body: { topic, difficulty, templateId }
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  后端                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Prompt构建                                                    │   │
│  │   - 注入JSON Schema                                                   │   │
│  │   - 注入模板容量限制（卡片数、字数上限）                                │   │
│  │   - 注入学科背景信息                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: LLM调用                                                       │   │
│  │   - 生成统一JSON Schema格式的内容                                     │   │
│  │   - 温度0.3，要求严格JSON输出                                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Step 3: 内容校验与截断                                                 │   │
│  │   - JSON格式校验（zod schema）                                        │   │
│  │   - 字数超限截断                                                      │   │
│  │   - 数字格式转换（01→一/壹，按模板风格）                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Step 4: 模板填充引擎 (TemplateFiller)                                  │   │
│  │   - 加载模板PPTX文件                                                  │   │
│  │   - 读取模板专属映射表                                                 │   │
│  │   - 按映射表将JSON内容写入对应shape                                    │   │
│  │   - 特殊处理：表格、bullet列表、多run段落、页码更新                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Step 5: 输出                                                          │   │
│  │   - 保存为 .pptx 文件                                                 │   │
│  │   - 可选：转换为PNG预览图                                              │   │
│  │   - 返回下载链接 + 预览图数组                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                                    │
                    Response: { success, pptxUrl, previewImages[] }
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  前端                                                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ PPT预览弹窗   │←───│ 缩略图网格    │←───│ 下载按钮      │                   │
│  │ (7页幻灯片)   │    │ (7张PNG)     │    │ (.pptx文件)   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 模块 | 路径 | 技术栈 | 状态 |
|------|------|--------|------|
| 模板资产 | `十二套教学用ppt/*.pptx` | PPTX文件 | 已就位 |
| 字段映射表 | `lib/slides/template-packs/mappings/*.json` | JSON | 1/12完成 |
| 模板元数据 | `lib/slides/template-packs/index.ts` | TypeScript | 待建 |
| 学科推断器 | `lib/slides/template-matcher.ts` | TypeScript | 待建 |
| 模板填充引擎 | `lib/slides/template-filler.ts` | Python (python-pptx) | PoC通过 |
| AI Prompt | `lib/prompts/slide-template-fill.md` | Markdown | 草案完成 |
| API路由 | `app/api/sky/slides/generate/route.ts` | Next.js API Route | 待改 |
| Gallery组件 | `components/sky/slides/template-gallery.tsx` | React + shadcn | 待建 |
| Fallback引擎 | `lib/slides/pptx-exporter.ts` | pptxgenjs | 已有，保留 |

---

## 三、开发阶段总览

| 阶段 | 名称 | 目标 | 预计工时 | 前置依赖 |
|------|------|------|----------|----------|
| Phase 1 | 核心引擎验证 | 验证2套模板端到端流程 | 2-3天 | 无 |
| Phase 2 | 引擎完善+扩展映射 | 解决复杂填充+完成4套映射 | 3-4天 | Phase 1 |
| Phase 3 | 前后端集成 | API改造+Gallery UI+Prompt上线 | 3-4天 | Phase 2 |
| Phase 4 | 完整映射+测试 | 12套全部映射+测试+上线 | 4-5天 | Phase 3 |

**总计: 12-16工作日**

---

## 四、Phase 1: 核心引擎验证（当前阶段）

### 4.1 目标
验证 "JSON → 模板填充 → PPTX输出" 的核心链路可行性。

### 4.2 任务清单

| 编号 | 任务 | 详细说明 | 状态 |
|------|------|----------|------|
| P1-1 | ~~现代几何风字段映射表~~ | 分析XML结构，建立shape_idx→field_path映射 | **已完成** |
| P1-2 | ~~填充脚本PoC~~ | 用python-pptx按映射表替换文本，输出PPTX | **已完成** |
| P1-3 | ~~验证输出~~ | 检查41个字段是否正确填入，格式是否保留 | **已完成** |
| P1-4 | 明快卡通风字段映射表 | 分析第2套模板，建立映射表 | 待执行 |
| P1-5 | 明快卡通风填充验证 | 用同一套JSON数据测试第2套模板 | 待执行 |
| P1-6 | 映射表格式标准化 | 定义统一的mapping.json Schema，确保12套模板格式一致 | 待执行 |

### 4.3 验收标准

- [ ] 现代几何风模板：41个字段100%正确替换，输出PPTX可用PowerPoint正常打开
- [ ] 明快卡通风模板：所有可替换字段正确填入
- [ ] 两套模板共用同一份JSON输入，验证Schema通用性
- [ ] 映射表JSON Schema文档化

### 4.4 交付物

1. `mapping_modern_geometric.json` — 现代几何风映射表
2. `mapping_cartoon.json` — 明快卡通风映射表
3. `mapping-schema.json` — 统一映射表JSON Schema定义
4. `poc_fill_template.py` — 填充引擎原型脚本
5. `docs/phase1-report.md` — Phase 1验证报告

---

## 五、Phase 2: 引擎完善 + 扩展模板映射

### 5.1 目标
解决Phase 1中发现的复杂填充问题，并将映射覆盖到4套模板。

### 5.2 Phase 1遗留问题清单

| 问题 | 影响 | 解决方案 |
|------|------|----------|
| P4/P5 summary是多段落bullet列表 | 简单文本替换会破坏格式 | 写专用函数：清空原段落→按`\n`分割→逐段重建并添加bullet符号 |
| P6表格需要用python-pptx操作cell | XML替换无法处理表格 | 用`table.cell(row, col).text = value`逐个填充 |
| P6 summary包含多run段落 | 替换run1时可能破坏格式 | 只替换长文本run，保留标题run |
| python-pptx与XML分析shape索引不一致 | 可能导致映射错位 | 统一用python-pptx作为唯一shape遍历工具 |

### 5.3 任务清单

| 编号 | 任务 | 详细说明 |
|------|------|----------|
| P2-1 | **多段落bullet列表替换** | 实现`fill_bullet_textbox(shape, lines[])`函数：清空text_frame→逐行添加段落→每段添加bullet run→恢复字体格式 |
| P2-2 | **表格填充** | 实现`fill_table(table_shape, headers[], rows[][])`函数：按模板容量截断行列→逐cell写入 |
| P2-3 | **多run段落安全替换** | 实现`fill_preserving_runs(shape, new_text, run_idx)`函数：只替换指定run的文本，保留其他run |
| P2-4 | **页码自动更新** | 实现`update_page_numbers(prs)`函数：遍历所有页码shape→更新为实际页码格式（如"04/07"） |
| P2-5 | **数字格式转换器** | 实现阿拉伯数字→中文数字转换：`01`→`一`、`02`→`二`，支持两种风格（简体/大写） |
| P2-6 | **古典书香风映射表** | 建立第3套模板映射（与几何风差异大：居中布局、书法字体、卷轴装饰） |
| P2-7 | **简约北欧风映射表** | 建立第4套模板映射（特殊：P4/P5是图表页，非文本卡片） |
| P2-8 | **TemplateFiller类封装** | 将PoC脚本封装为正式Python类：`TemplateFiller(template_path, mapping_path)` |

### 5.4 验收标准

- [ ] 现代几何风：100%字段替换（含summary、表格、页码）
- [ ] 明快卡通风：100%字段替换
- [ ] 古典书香风：映射表完成，验证通过
- [ ] 简约北欧风：映射表完成，验证通过（含图表特殊处理方案）
- [ ] `TemplateFiller`类API稳定，单测通过

### 5.5 交付物

1. `lib/slides/template-filler/` — Python模块目录
   - `__init__.py`
   - `filler.py` — TemplateFiller主类
   - `bullet.py` — bullet列表处理
   - `table.py` — 表格处理
   - `utils.py` — 数字转换、页码更新等工具
2. `tests/test_filler.py` — 单元测试
3. 4套映射表JSON文件
4. `docs/phase2-report.md` — Phase 2验证报告

---

## 六、Phase 3: 前后端集成

### 6.1 目标
将填充引擎接入Next.js后端，完成前端Gallery UI，实现完整用户流程。

### 6.2 任务清单

#### 后端（Python服务集成）

| 编号 | 任务 | 详细说明 |
|------|------|----------|
| P3-1 | **Python服务封装** | 将TemplateFiller封装为可调用函数：`generate_pptx(template_id, content_json) -> pptx_bytes` |
| P3-2 | **API路由改造** | 修改`app/api/sky/slides/generate/route.ts`：新增templateId参数→调用Python脚本→返回PPTX文件 |
| P3-3 | **Prompt改造** | 将`lib/prompts/slide-template-fill.md`接入实际LLM调用，验证AI输出质量 |
| P3-4 | **JSON校验** | 用zod定义JSON Schema，对AI输出做严格校验和自动修复 |
| P3-5 | **Fallback逻辑** | 当templateId未提供或填充失败时，回退到旧pptxgenjs生成 |
| P3-6 | **PPTX转PNG** | 集成LibreOffice headless转换，生成7页预览图（可选功能） |

#### 前端

| 编号 | 任务 | 详细说明 |
|------|------|----------|
| P3-7 | **模板Gallery组件** | 实现`TemplateGallery`弹窗：12宫格缩略图、默认选中态、hover效果、确认按钮 |
| P3-8 | **学科推断字典** | 实现`inferSubject(topic)`函数：关键词匹配→返回推荐模板ID |
| P3-9 | **生成流程改造** | 修改生成按钮逻辑：先弹Gallery→用户确认→调用API（带templateId） |
| P3-10 | **预览组件** | 实现PPT预览弹窗：7页缩略图网格+下载按钮 |
| P3-11 | **删除旧主题系统** | 移除ThemePicker中的6旧主题，清理`lib/slides/pptx-themes.ts`中废弃代码 |

### 6.3 API接口定义

```typescript
// POST /api/sky/slides/generate
interface GenerateRequest {
  topic: string;           // 课件主题
  difficulty?: string;     // 学段：初中/高中/大学
  templateId?: string;     // 模板ID（可选，未提供则后端推断）
}

interface GenerateResponse {
  success: boolean;
  slides?: Slide[];        // 前端预览用slide数据（兼容旧接口）
  pptxUrl?: string;        // PPTX下载链接
  previewImages?: string[]; // 7页PNG预览图URL（可选）
  templateId: string;      // 实际使用的模板ID
  error?: string;
}
```

### 6.4 验收标准

- [ ] 用户输入"勾股定理"→弹出Gallery→默认选中"现代几何风"→可切换→确认→生成PPT
- [ ] 生成的PPTX可用PowerPoint正常打开，内容正确
- [ ] API响应时间<30秒（含LLM生成+模板填充）
- [ ] Fallback机制工作正常（停止Python服务后仍能生成基础PPT）
- [ ] 旧主题系统已完全移除，无残留引用

### 6.5 交付物

1. 改造后的API路由
2. `TemplateGallery`组件
3. `lib/slides/template-matcher.ts`
4. 更新的Prompt文件
5. `docs/phase3-report.md`

---

## 七、Phase 4: 完整映射 + 测试 + 上线

### 7.1 目标
完成全部12套模板的映射，全面测试，清理代码，正式上线。

### 7.2 任务清单

| 编号 | 任务 | 详细说明 |
|------|------|----------|
| P4-1 | **批量建映射表** | 完成剩余8套模板的映射表（商务专业、活力运动、海洋探索、清新水彩、清新自然、温暖人文、田园复古、科技未来） |
| P4-2 | **批量验证** | 对12套模板各执行一次完整填充，检查输出质量 |
| P4-3 | **边界测试** | 超长文本、特殊字符、空内容、多字节字符等边界case |
| P4-4 | **性能测试** | 测量单次生成耗时（LLM+填充+打包），目标<30秒 |
| P4-5 | **字体回退测试** | 在无特殊字体环境打开输出PPT，验证显示效果 |
| P4-6 | **预览图生成** | 批量生成12套模板×7页=84张预览图PNG |
| P4-7 | **代码清理** | 删除PoC脚本、临时文件、调试日志 |
| P4-8 | **文档更新** | 更新README、API文档、部署文档 |

### 7.3 验收标准

- [ ] 12套模板全部有可用的映射表
- [ ] 每套模板至少通过1次端到端生成验证
- [ ] 无已知bug（P0/P1级别）
- [ ] 代码通过ESLint + Python flake8检查
- [ ] 文档完整，新成员可按文档独立上手

### 7.4 交付物

1. 12套完整映射表
2. 84张预览图PNG
3. 清理后的代码仓库
4. 更新后的技术文档
5. `docs/phase4-report.md` — 最终验收报告

---

## 八、JSON Schema（锁定版）

```typescript
interface SlideContentPayload {
  // P1 封面
  cover: {
    en_tag?: string;      // 英文小标签，2-4词全大写
    title: string;        // 中文大标题，4-8字
    subtitle: string;     // 副标题，15-25字
  };

  // P2 目录
  toc: {
    title?: string;       // 目录页标题，默认"目录"
    items: Array<{
      num: string;        // 编号，如"01"（后端转换）
      title: string;      // 章节标题，≤6字
      desc: string;       // 章节描述，≤15字
    }>; // 固定3项
  };

  // P3 章节过渡页
  chapter: {
    num: string;          // 大数字，如"01"
    en: string;           // 英文，如"CHAPTER ONE"
    title: string;        // 章节标题
    subtitle: string;     // 章节副标题
  };

  // P4 内容页A
  content_a: {
    tag: string;          // 英文标签，全大写
    title: string;        // 中文标题，≤8字
    cards: Array<{        // 最多5个，按重要性排序
      title: string;      // 卡片标题，≤4字
      desc: string;       // 卡片描述，≤50字
    }>;
    summary: string;      // 底部总结，≤100字
  };

  // P5 内容页B
  content_b: {
    tag: string;          // 英文标签，全大写
    title: string;        // 中文标题，≤8字
    cards?: Array<{       // 供卡片型模板使用
      title: string;
      desc: string;       // ≤80字
    }>;
    featured?: {          // 供图文型模板使用
      body: string;       // 大段文字，≤200字
      highlight?: string; // 关键句高亮，≤30字
    };
    summary: string;      // 底部总结，≤80字
  };

  // P6 表格页
  table: {
    tag: string;          // 英文标签，全大写
    title: string;        // 中文标题，≤10字
    headers: string[];    // 表头，建议4列
    rows: string[][];     // 数据行，建议4-6行
    summary: string;      // 表格下方总结，≤80字
  };

  // P7 结尾页
  end: {
    end_en?: string;      // 英文结束语，如"THE END"
    slogan: string;       // 中文大标语，6-10字
    subtitle: string;     // 副标语，15-25字
  };
}
```

---

## 九、映射表JSON Schema

```json
{
  "$schema": "mapping",
  "template_id": "modern-geometric",
  "template_name": "现代几何风教学模板",
  "slides": {
    "slide1": {
      "page_type": "cover",
      "fields": [
        {
          "field": "cover.en_tag",
          "shape_idx": 4,
          "para_idx": 0,
          "run_idx": 0,
          "max_chars": 30
        }
      ]
    }
  },
  "capacity": {
    "content_a_cards": 6,
    "content_b_cards": 4,
    "table_cols": 4,
    "table_rows": 5
  },
  "special_handlers": ["bullet_list", "table", "multi_run"]
}
```

---

## 十、12套模板映射进度追踪

| 序号 | 模板名称 | 模板ID | Phase 1 | Phase 2 | Phase 4 | 状态 |
|------|----------|--------|---------|---------|---------|------|
| 1 | 现代几何风 | modern-geometric | ✅ | ✅ | ✅ | **完成** |
| 2 | 明快卡通风 | cartoon | ✅ | ✅ | ✅ | **完成** |
| 3 | 古典书香风 | classical | - | ✅ | ✅ | **完成** |
| 4 | 简约北欧风 | nordic | - | ✅ | ✅ | **完成** |
| 5 | 商务专业风 | business | - | - | ✅ | **完成** |
| 6 | 活力运动风 | sports | - | - | ✅ | **完成** |
| 7 | 海洋探索风 | ocean | - | - | ✅ | **完成** |
| 8 | 清新水彩风 | watercolor | - | - | ✅ | **完成** |
| 9 | 清新自然风 | nature | - | - | ✅ | **完成** |
| 10 | 温暖人文风 | humanistic | - | - | ✅ | **完成** |
| 11 | 田园复古风 | vintage | - | - | ✅ | **完成** |
| 12 | 科技未来风 | tech | - | - | ✅ | **完成** |

---

## 十一、风险与应对

| 风险 | 可能性 | 影响 | 应对策略 |
|------|--------|------|----------|
| LLM不严格遵循JSON Schema | 中 | 高 | zod校验+自动修复；Prompt中加入自检清单 |
| 特殊字体用户端缺失 | 高 | 中 | 测试字体嵌入可行性；无法嵌入时替换为系统字体（微软雅黑） |
| 某套模板结构极特殊（如北欧风图表页） | 中 | 高 | Phase 2优先验证差异大的模板；特殊模板单独写handler |
| JSON内容超长导致文本溢出 | 中 | 中 | 后端截断+前端提示用户可编辑 |
| python-pptx与Node.js集成复杂 | 低 | 中 | 使用`child_process.spawn`调用Python脚本；或考虑用`python-shell`库 |
| 12套模板映射工作量超预期 | 中 | 中 | 每套模板独立映射，可并行；特殊模板延后处理 |
| 旧系统删除后兼容性破坏 | 低 | 高 | Fallback机制确保旧调用方不受影响；灰度发布 |

---

## 十二、附录

### A. 目录规范

```
lib/slides/
├── template-packs/              # 模板资产与映射
│   ├── index.ts                 # 模板元数据注册表
│   ├── mappings/                # 字段映射表
│   │   ├── modern-geometric.json
│   │   ├── cartoon.json
│   │   └── ... (12套)
│   └── previews/                # 预览图
│       ├── modern-geometric/
│       │   ├── slide1.png
│       │   └── ...
│       └── ...
├── template-filler/             # Python填充引擎（Phase 2后）
│   ├── __init__.py
│   ├── filler.py
│   ├── bullet.py
│   ├── table.py
│   └── utils.py
├── template-matcher.ts          # 学科推断器
└── ...（已有文件保留）

app/api/sky/slides/
├── generate/
│   └── route.ts                 # 改造后的生成API
└── ...

components/sky/slides/
├── template-gallery.tsx         # 模板选择弹窗（新增）
├── slides-page.tsx              # 主页面（改造）
└── ...
```

### B. 关键技术决策记录

| 决策 | 结论 | 日期 |
|------|------|------|
| 技术路线 | 模板切片填充（python-pptx）+ pptxgenjs兜底 | 2026-05-24 |
| 模板数量 | 12套设计师PPT模板，7页统一结构 | 2026-05-24 |
| 旧主题系统 | 彻底删除，替换为模板Gallery | 2026-05-24 |
| AI输出格式 | 统一JSON Schema，不做布局决策 | 2026-05-24 |
| 卡片截断策略 | JSON输出5个，模板按容量取前N个 | 2026-05-24 |
| 数字格式 | JSON用阿拉伯数字，后端按模板风格转换 | 2026-05-24 |
| P4/P5 dual mode | JSON同时提供cards和featured，后端选择 | 2026-05-24 |
| 预览图方案 | LibreOffice headless批量转换PNG | 2026-05-24 |

---

*本文档确认后，开发严格按Phase执行，每Phase结束提交验收报告。*
