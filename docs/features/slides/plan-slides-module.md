# 幻灯片模块重构规划文档

> 创建时间: 2026-05-22
> 对应需求: 前端 UI 美化 + PPT 导出增强 + 模板系统升级
> 预计周期: 15-20 工作日

---

## 一、模块概述

将 OpenMAIC-B-001 的 Sky Classroom 幻灯片模块从"功能可用"升级为"视觉精美、导出专业、模板丰富"的生产级课件生成系统。覆盖前端预览器、PPT 导出引擎、模板设计体系三大核心子系统。

---

## 二、架构设计

### 2.1 数据流图

```
用户输入主题
    ↓
[API] POST /api/sky/slides/generate
    ├── Template 模式: AI 选模板 → assembleSlides(slots) → 返回 Slide[]
    └── Legacy 模式: AI 生成完整 JSON → generateSlides() → 返回 Slide[]
    ↓
[Store] useSkyClassroomStore.slides (Zustand + localStorage)
    ↓
[UI] SlidesPage 三栏编辑器
    ├── Left: AvatarSelector + ThemePicker + ThumbnailList(缩略图渲染)
    ├── Center: SlideViewer(画布预览) + AvatarPlayer(讲解控制)
    └── Bottom: 分页控制 + 导出按钮
    ↓
[Export] POST /api/sky/slides/export-pptx
    └── pptx-exporter.ts → 主题感知 + 全元素支持 → .pptx Buffer
```

### 2.2 模块划分

| 子系统 | 职责 | 关键文件 |
|--------|------|----------|
| **UI 渲染层** | 编辑器界面、预览器、控件 | `components/sky/slides/*` |
| **模板引擎** | 模板定义、组装、主题注入 | `lib/slides/slide-templates.ts`, `lib/slides/layouts.ts` |
| **主题系统** | 主题 Token、颜色、字体、装饰 | `lib/slides/pptx-themes.ts` |
| **生成引擎** | AI Prompt 构建、JSON 解析、后处理 | `lib/slides/slide-generator.ts`, `app/api/sky/slides/generate/route.ts` |
| **导出引擎** | PPTX 构建、元素转换、主题应用 | `lib/slides/pptx-exporter.ts`, `lib/export/course-exporter.ts` |
| **形象系统** | 虚拟形象配置、语音讲解 | `lib/slides/avatar-config.ts`, `components/sky/slides/avatar-player.tsx` |

---

## 三、文件清单

### 3.1 新建文件

| 文件路径 | 职责 | 优先级 |
|----------|------|--------|
| `lib/slides/themes/index.ts` | 主题系统入口，统一导出所有主题 | P0 |
| `lib/slides/themes/modern-editor.ts` | 现代编辑器风格主题（深色/浅色环境） | P0 |
| `lib/slides/themes/templates/` | 各主题配套模板装饰元素定义 | P0 |
| `lib/slides/slide-templates-v2.ts` | 新版模板体系（15+ 模板，主题感知） | P0 |
| `lib/slides/template-decorators.ts` | 模板装饰元素生成器（几何形状、渐变、线条） | P0 |
| `components/sky/slides/slide-thumbnail.tsx` | 缩略图渲染组件（基于 Slide 数据生成预览图） | P1 |
| `components/sky/slides/theme-preview-card.tsx` | 主题预览卡片（封面缩略图 + 字体展示） | P1 |
| `components/sky/slides/slide-editor-shell.tsx` | 新版编辑器外壳（Canva 风格三栏布局） | P1 |
| `components/sky/slides/avatar-speech-player.tsx` | 讲解播放器（进度条、句高亮、播放控制） | P1 |
| `lib/slides/pptx-shape-mapper.ts` | Shape SVG Path → pptxgenjs 内置形状映射 | P0 |
| `lib/slides/pptx-image-handler.ts` | 图片元素导出处理（base64/URL → PPT 图片） | P0 |
| `lib/slides/pptx-table-handler.ts` | 表格元素导出处理 | P0 |
| `tests/slides/template-v2.test.ts` | 新版模板单元测试 | P1 |
| `tests/slides/pptx-export-shape.test.ts` | Shape 导出测试 | P1 |
| `tests/slides/pptx-export-image.test.ts` | Image 导出测试 | P1 |
| `tests/slides/pptx-export-table.test.ts` | Table 导出测试 | P1 |

### 3.2 修改文件

| 文件路径 | 修改内容 | 优先级 |
|----------|----------|--------|
| `lib/slides/pptx-themes.ts` | 扩展主题 Token（渐变、装饰、字体组合） | P0 |
| `lib/slides/slide-templates.ts` | 保留旧模板兼容，新增 v2 模板注册 | P0 |
| `lib/slides/slide-generator.ts` | 主题注入、智能布局引擎、网格对齐 | P0 |
| `lib/slides/pptx-exporter.ts` | 补全元素类型、主题感知封面、shape 映射 | P0 |
| `lib/export/course-exporter.ts` | 统一使用主题 Token、美化封面/目录/封底 | P0 |
| `lib/slides/layouts.ts` | 扩充布局类型、加视觉提示 | P1 |
| `app/api/sky/slides/generate/route.ts` | Prompt 增加视觉设计规范章节 | P0 |
| `components/sky/slides/slides-page.tsx` | 重写为 Canva 风格布局 | P1 |
| `components/sky/slides/slide-viewer.tsx` | 放映感增强（环境暗色、物理投影、切页动画） | P1 |
| `components/sky/slides/theme-picker.tsx` | 卡片式预览、字体/颜色展示 | P1 |
| `components/sky/slides/thumbnail-list.tsx` | 集成缩略图渲染 | P1 |
| `components/sky/slides/avatar-player.tsx` | 讲解进度控制、翻页联动 | P1 |
| `components/sky/slides/avatar-selector.tsx` | 视觉微调（保持现有结构） | P2 |
| `lib/slides/types.ts` | 扩展类型定义（主题 Token、模板参数） | P0 |
| `lib/slides/index.ts` | 导出新增模块 | P0 |

### 3.3 废弃/删除文件

| 文件路径 | 原因 |
|----------|------|
| `lib/export/use-export-pptx.ts` | 存在 merge conflict marker，需清理后评估是否保留 |

---

## 四、接口定义

### 4.1 类型扩展

```typescript
// lib/slides/types.ts 新增

interface ThemeToken {
  id: string;
  name: string;
  description: string;
  // 色彩
  coverBg: string;           // 封面背景（支持渐变描述）
  coverBgGradient?: { from: string; to: string; angle: number };
  contentBg: string;
  accent: string;
  accentSecondary: string;
  coverTitleColor: string;
  coverSubColor: string;
  bodyColor: string;
  bodyMutedColor: string;
  pageNumColor: string;
  // 字体组合
  fontFamily: string;
  headingFont: string;
  // 字号阶梯
  coverTitleSize: number;
  titleFontSize: number;
  bodyFontSize: number;
  captionFontSize: number;
  // 布局
  useWideContent: boolean;
  // 装饰
  coverDecorations: DecorationDef[];  // 封面装饰元素定义
  bulletStyle: 'dot' | 'square' | 'check' | 'arrow';
}

interface DecorationDef {
  type: 'shape' | 'line' | 'gradient-overlay';
  position: { x: number; y: number; w: number; h: number };
  style: Record<string, unknown>;
}

interface TemplateParamsV2 extends TemplateParams {
  theme?: ThemeToken;        // 模板接收主题 Token
  imageUrl?: string;         // 图片 URL
  imagePosition?: 'left' | 'right' | 'full' | 'top';
}
```

### 4.2 关键函数签名

```typescript
// lib/slides/slide-templates-v2.ts
export function createTemplate(id: TemplateId, params: TemplateParamsV2, theme: ThemeToken): Slide;
export function assembleSlidesV2(slots: TemplateSlot[], theme: ThemeToken): Slide[];

// lib/slides/pptx-shape-mapper.ts
export function mapShapeToPptx(path: string, viewBox: string): { shapeType: PptxShapeType; points?: PptxPoint[] } | null;

// lib/slides/pptx-image-handler.ts
export async function addImageToSlide(pptxSlide: PptxSlide, element: PPTImageElement, theme: ThemeToken): Promise<void>;

// lib/slides/pptx-table-handler.ts
export function addTableToSlide(pptxSlide: PptxSlide, element: PPTTableElement, theme: ThemeToken): void;

// lib/slides/template-decorators.ts
export function generateCoverDecorations(theme: ThemeToken): PPTElement[];
export function generateBulletElements(items: string[], theme: ThemeToken, startY: number): PPTElement[];
```

---

## 五、假设清单

1. **AI 模型能力假设**：假设 LLM 能够按照增强后的 Prompt 生成符合视觉规范的 Slide JSON，包括正确的元素位置和颜色值。
2. **图片来源假设**：假设导出时图片元素以 base64 或 URL 形式存在，服务端可以访问（或已预下载到 IndexedDB）。
3. **pptxgenjs 能力假设**：假设 pptxgenjs 支持自定义形状（custGeom）、图片嵌入、表格渲染，且性能在 20 页幻灯片内可接受。
4. **浏览器能力假设**：假设目标浏览器支持 ResizeObserver、CSS backdrop-filter、CSS grid/flex 布局。
5. **主题兼容性假设**：假设现有 `.pptx` 导出调用方（如 Sky Solve 模块）不使用主题系统，或可以默认回退到 `sky-blue` 主题。
6. **模板模式为主假设**：Template 模式是主要使用路径，Legacy 模式保留但不作为优化重点。

---

## 六、风险点

| 风险 | 严重程度 | 预案 |
|------|----------|------|
| pptxgenjs 自定义形状转换复杂度高 | 高 | 先支持常见形状（rect/roundRect/ellipse/arrow），复杂 shape fallback 为 rect |
| 图片导出时 CORS/URL 失效 | 中 | 服务端代理下载（复用 `/api/proxy-media`），失败时 fallback 为占位框 |
| 模板增多后 AI 选择模板准确率下降 | 中 | Prompt 中限制每类模板使用次数，加模板推荐逻辑（根据 topic 关键词匹配） |
| 前端 UI 大改引入回归问题 | 中 | 保留旧组件为 `_legacy` 备份，新组件并行开发，切换开关控制 |
| 主题 Token 扩展后类型不兼容 | 低 | ThemeToken 使用可选字段扩展，旧主题通过 adapter 函数升级 |
| 工作量超出预期 | 中 | 按 P0/P1/P2 优先级分 3 个迭代交付，每迭代验收后进入下一阶段 |

---

## 七、迭代计划

### 迭代 1: 核心骨架（P0，预计 5-7 天）
1. 主题系统扩展（新 ThemeToken + 3 套主题）
2. 模板 v2 体系（15+ 模板，主题感知）
3. 生成引擎升级（Prompt 增强 + 主题注入）
4. 导出引擎补全（shape/image/table + 主题感知封面）

### 迭代 2: 前端升级（P1，预计 5-7 天）
1. 编辑器外壳重写（Canva 风格）
2. 预览器增强（放映感 + 切页动画）
3. 缩略图渲染 + 主题预览卡片
4. 形象播放器完善（进度控制 + 翻页联动）

### 迭代 3: 打磨收尾（P2，预计 3-5 天）
1. 新增模板测试 + 导出测试
2. 边界 case 修复（空数据、大数量幻灯片）
3. 性能优化（缩略图懒渲染、导出流式处理）
4. 清理 legacy 代码

---

## 八、变更范围确认

✅ 本次修改涉及的目录：
- `lib/slides/` — 核心逻辑全面重构
- `components/sky/slides/` — UI 组件全面重构
- `app/api/sky/slides/` — API 接口增强
- `lib/export/` — 导出引擎增强
- `tests/slides/` — 新增测试

❌ 本次不修改的目录（STFXZ 原则）：
- `lib/solve/` — 解题模块（数据归属原则）
- `lib/mistakes/` — 错题本模块
- `lib/orchestration/` — 多智能体编排
- `app/api/` 下非 `sky/slides` 的路由

---

*规划文档 v1.0 — 等待用户确认后进入 Phase 3*
