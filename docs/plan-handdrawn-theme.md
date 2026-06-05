# 规划文档：手绘风主题（handdrawn）

> 模块：模块 F · 幻灯片优化
> 任务编号：F-001-P1
> 创建时间：2026-06-03

---

## 模块概述

为 PPTX 导出主题系统新增一套"手绘风"（handdrawn）主题，补全 F-001 任务要求的 3 套新增主题中缺失的 1 套。

---

## 架构设计

主题系统采用**集中定义 + 注册表导出**模式：

```
modern-editor.ts（主题定义源）
  ├── SKY_BLUE_THEME
  ├── MINIMAL_THEME
  ├── ACADEMIC_THEME
  ├── TECH_DARK_THEME
  ├── NATURE_FRESH_THEME
  ├── MACARON_PINK_THEME
  └── HANDDRAWN_THEME  ← 新增

      ↓

ALL_THEMES / THEME_MAP / getThemeById
      ↓

themes/index.ts（barrel export）
      ↓

pptx-themes.ts（向后兼容层 + PPTX_THEMES 映射）
      ↓

pptx-exporter.ts（导出时引用）
```

手绘风主题的数据流与其他 6 套主题完全一致，无新增架构复杂度。

---

## 文件清单

| # | 文件路径 | 操作 | 职责 |
|---|---------|------|------|
| 1 | `lib/slides/themes/modern-editor.ts` | 修改 | 新增 `HANDDRAWN_THEME` 定义，更新 `ALL_THEMES` / `THEME_MAP` |
| 2 | `lib/slides/types.ts` | 修改 | `PptxThemeId` 联合类型增加 `'handdrawn'` |
| 3 | `lib/slides/pptx-themes.ts` | 修改 | `PPTX_THEMES` 映射增加手绘风 |
| 4 | `tests/slides/theme-tokens.test.ts` | 新建 | 验证主题注册表完整性 + 手绘风主题属性 |

---

## 接口定义

无新增接口。仅扩展现有类型和常量。

---

## 手绘风主题设计参数（草案）

基于现有 6 套主题的设计语言，手绘风拟采用以下参数：

| 属性 | 值 | 设计意图 |
|------|-----|---------|
| `id` | `'handdrawn'` | 标识符 |
| `name` | `'手绘风'` | 中文名 |
| `description` | `'暖黄纸张底色，手绘线条与涂鸦点缀，亲切自然'` | 描述 |
| `coverBg` | `'#F5F0E6'` | 暖黄纸张色 |
| `coverBgGradient` | `{ from: '#F5F0E6', to: '#EDE4D3', angle: 135 }` | 纸张微渐变 |
| `contentBg` | `'#FDFCF8'` | 略亮的米白 |
| `accent` | `'#D4A574'` | 咖啡色/马克笔色 |
| `accentSecondary` | `'#8B9A7C'` | 鼠尾草绿（自然感）|
| `accentLight` | `'#F0E6D3'` | 浅咖啡 |
| `coverTitleColor` | `'#5C4033'` | 深咖啡色 |
| `coverSubColor` | `'#8B6F5C'` | 中咖啡色 |
| `bodyColor` | `'#3D3229'` | 深棕（阅读色）|
| `bodyMutedColor` | `'#A09080'` | 灰棕 |
| `pageNumColor` | `'#D4A574'` | 咖啡 |
| `dividerColor` | `'#E8DCC8'` | 浅分隔线 |
| `fontFamily` | `'Microsoft YaHei'` | 中文字体（PPTX 安全字体）|
| `headingFont` | `'Comic Sans MS'` | 手写感西文字体 |
| `coverTitleSize` | 38 | 略活泼 |
| `coverSubSize` | 18 | — |
| `titleFontSize` | 26 | — |
| `bodyFontSize` | 15 | — |
| `captionFontSize` | 12 | — |
| `bulletSize` | 16 | — |
| `useWideContent` | false | — |
| `pageMargin` | 60 | — |
| `contentMaxWidth` | 880 | — |
| `bulletStyle` | `'dot'` | — |
| `shadowColor` | `'rgba(92, 64, 51, 0.06)'` | 柔和阴影 |
| `shapeOutlineColor` | `'#D4A574'` | 咖啡描边 |

**封面装饰（coverDecorations）**：
1. 不规则椭圆（手绘感圆圈）×2，不同大小，低透明度
2. 手绘感短线条 ×1，斜向
3. 右下角小涂鸦圆点

---

## 假设清单

1. **假设用户期望的是"素描手账"风格**，而非卡通/黑板风格。如理解偏差，配色和装饰需调整。
2. **假设 `Comic Sans MS` 作为 headingFont 在 PPTX 中可正常渲染**。如不可用，回退到 `'Microsoft YaHei'`。
3. **假设无需新增前端 UI 组件**（主题选择器已存在，新增主题自动出现在列表中）。
4. **假设测试只需验证主题注册表完整性**，无需测试 PPTX 实际渲染效果（渲染测试由现有测试覆盖）。

---

## 风险点

| 风险 | 影响 | 预案 |
|------|------|------|
| `handdrawn` id 与其他模块冲突 | 中等 | 全局搜索确认无使用 |
| `Comic Sans MS` 在部分系统缺失 | 低 | PPTX 有字体回退机制，且 `fontFamily` 主字体为 `'Microsoft YaHei'` |
| 现有测试硬编码了 6 套主题 | 低 | 检查并更新硬编码断言 |

---

*等待用户确认后进入 Phase 3。*
