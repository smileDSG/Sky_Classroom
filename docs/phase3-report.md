# Phase 3 验收报告：前后端集成

> 日期: 2026-05-24
> 状态: **通过**

---

## 一、验收目标

将模板填充引擎接入Next.js后端，完成前端Gallery UI，实现完整用户流程。

---

## 二、任务完成情况

### 后端

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P3-1 | Python CLI封装 | ✅ | `cli.py` 支持 `--template-id` / `--content-json` / `--output` |
| P3-2 | API路由改造 | ✅ | `generate/route.ts` 新增 `templateId` 参数分支 |
| P3-3 | Prompt改造 | ✅ | `lib/prompts/slide-template-fill.md` + `generator.ts` 动态Prompt构建 |
| P3-4 | JSON校验 | ✅ | LLM retry + validate 确保返回有效JSON |
| P3-5 | Fallback逻辑 | ✅ | template pack失败 → 自动回退到 v2 template mode |

### 前端

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| P3-7 | TemplateGallery组件 | ✅ | `template-pack-gallery.tsx` 12宫格 + 学科推断高亮 |
| P3-8 | 学科推断字典 | ✅ | `template-packs/index.ts` `inferTemplateByTopic()` |
| P3-9 | 生成流程改造 | ✅ | 点击生成 → 弹Gallery → 选模板 → 调用API → 下载PPTX |
| P3-10 | 预览组件 | ⚠️ | PPTX文件直接下载，预览图可在Phase 4增强 |
| P3-11 | 删除旧主题系统 | ⏳ | 留待Phase 4清理，避免回归风险 |

---

## 三、新增/修改文件清单

### 后端

| 文件 | 类型 | 说明 |
|------|------|------|
| `lib/slides/template-filler/cli.py` | 新增 | Python CLI入口 |
| `lib/slides/template-packs/generator.ts` | 新增 | 模板填充生成器（Prompt构建+Python调用） |
| `lib/slides/template-packs/index.ts` | 新增 | 12套模板元数据注册表+学科推断 |
| `lib/prompts/slide-template-fill.md` | 新增 | 统一JSON Schema Prompt模板 |
| `app/api/sky/slides/generate/route.ts` | 修改 | 新增templateId参数分支 |

### 前端

| 文件 | 类型 | 说明 |
|------|------|------|
| `components/sky/slides/template-pack-gallery.tsx` | 新增 | 12套模板选择弹窗 |
| `components/sky/slides/slides-page.tsx` | 修改 | 集成新生成流程 |

---

## 四、用户流程

```
用户输入主题（如"勾股定理"）
    ↓
点击【生成】按钮
    ↓
弹出 TemplatePackGallery（12宫格）
    ├── 根据主题自动推断并高亮推荐模板（如"现代几何风"）
    └── 用户可自由切换到其他模板
    ↓
点击【确认生成】
    ↓
POST /api/sky/slides/generate
    Body: { topic, difficulty, templateId }
    ↓
后端：
    1. 构建Prompt（注入模板容量限制）
    2. 调用LLM生成统一JSON
    3. 调用Python CLI填充PPTX
    4. 保存到 public/temp/pptx/
    ↓
返回 { success, pptxUrl, fileName }
    ↓
前端自动触发PPTX下载
```

---

## 五、API接口更新

```typescript
// POST /api/sky/slides/generate
interface GenerateRequest {
  topic: string;
  difficulty?: 'junior' | 'senior' | 'college';
  templateId?: string;  // 新增：模板包ID
}

interface GenerateResponse {
  success: boolean;
  // 模板填充模式返回
  pptxUrl?: string;
  fileName?: string;
  filledCount?: number;
  totalFields?: number;
  // 回退模式返回
  slides?: Slide[];
  generationTime?: number;
  error?: string;
}
```

---

## 六、关键设计决策

1. **Node.js → Python 调用方式**：使用 `child_process.spawn`，通过命令行参数传递JSON，stdout返回结果JSON。简单可靠，无需额外依赖。

2. **PPTX文件存储**：生成到 `public/temp/pptx/`，通过 `/temp/pptx/xxx.pptx` URL直接下载。需配合定时清理任务（Phase 4）。

3. **Fallback策略**：模板填充失败 → 自动回退到 v2 template mode → 仍失败则回退到 Legacy mode。三层保障。

4. **Prompt构建**：`generator.ts` 动态构建Prompt，注入当前模板的容量限制（卡片数、表格行列数），让AI生成符合模板容量的内容。

---

## 七、遗留问题（Phase 4解决）

| 问题 | 说明 |
|------|------|
| PPTX预览图 | 当前直接下载PPTX，无页面预览。Phase 4可用LibreOffice转PNG |
| 临时文件清理 | public/temp/pptx/ 目录需定时清理，避免磁盘溢出 |
| 旧主题系统删除 | 需确认无其他模块依赖后安全移除 |
| 8套模板映射 | 商务/运动/海洋/水彩/自然/人文/田园/科技 |
| 字体回退 | 特殊字体在目标系统缺失时的处理 |

---

## 八、验收结论

**Phase 3 通过。**

前后端集成完成，完整用户流程打通：输入主题 → 选择模板 → AI生成 → 下载PPTX。可进入 **Phase 4: 完整映射 + 测试 + 上线**。
