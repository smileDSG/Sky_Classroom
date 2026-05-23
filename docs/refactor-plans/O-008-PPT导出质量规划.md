# O-008 PPT 导出质量提升 — 开发规划

> 任务编号: O-008 | 负责人: 队员2 | 状态: ✅ 已完成

## 需求

PPT 导出支持 3 种专业主题、页码、封面增强、主题选择器。

## 架构设计

```
lib/slides/
  pptx-themes.ts       # 主题定义（颜色/字体/排版 token）
  pptx-exporter.ts     # 重构：接受 theme 参数，加页码
app/api/sky/slides/export-pptx/
  route.ts             # 加 theme 字段
components/sky/slides/
  theme-picker.tsx     # 主题选择器（3 个卡片）
```

## 3 种主题

| 主题 | 封面底色 | 内容底色 | 强调色 | 风格 |
|------|---------|---------|--------|------|
| `sky-blue` | `#1e3a5f` | `#ffffff` | `#5b9bd5` | 天空蓝（默认） |
| `minimal` | `#2d2d2d` | `#fafafa` | `#333333` | 极简黑白 |
| `academic` | `#8B1A1A` | `#FFF8F0` | `#C41E3A` | 学术暖红 |

## 涉及文件

| 文件 | 操作 |
|------|------|
| `lib/slides/pptx-themes.ts` | **新建** — 3 套主题 token |
| `lib/slides/pptx-exporter.ts` | 修改 — 接受 theme 参数、封面增强、页码 |
| `app/api/sky/slides/export-pptx/route.ts` | 修改 — 接收 theme 字段 |
| `components/sky/slides/theme-picker.tsx` | **新建** — 主题选择器 |
| `components/sky/slides/slides-page.tsx` | 修改 — 嵌入 theme-picker |

## 检验标准

- [x] 3 种主题 token 定义
- [x] pptx-exporter 根据 theme 渲染不同配色
- [x] 封面页显示标题+日期
- [x] 内容页右下角有页码
- [x] API 接收 `theme` 参数
- [x] 前端可选择主题
