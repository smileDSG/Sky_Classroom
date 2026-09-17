# 智眸无界 · 整体性能提升方案

> 状态：调研完成，待评审
> 日期：2026-09-15
> 范围：全站加载性能（首屏 / 资源体积 / 请求瀑布 / 构建配置）

本方案基于对现有代码与既有构建产物的实际测量得出，结论均标注了证据来源与预期收益，优先级从高到低排列，均可独立落地、互不阻塞。

---

## 一、结论速览

当前加载慢的核心根因，按影响排序：

1. **全站共享的 905KB 渲染阻塞 CSS** —— 每个页面（含登录、首页、云端智囊各页）都要先下载并解析这与页面无关的巨型样式表，是 FCP/LCP 的最大拖累。
2. **根布局 `dynamic = 'force-dynamic'`** —— 强制所有页面关闭静态优化/静态 HTML 缓存，每次访问都由服务器实时完整渲染，TTFB 偏高且无法命中 CDN 缓存。
3. **首屏客户端 API 瀑布** —— 根布局挂载了 6+ 个客户端 Provider，进页面稳定前要串行打完 `auth/me`、`access-code/status`、`server-providers`、`startup-cache-check` 等请求；慢网下每多一次跨网 RTT 都很伤可交互时间。
4. **无用的全局依赖进 bundle** —— `animate.css`（93KB）被全局引入但全项目 0 使用；`katex.min.css`（仅数学页需要）也被加载进所有页面。
5. **客户端 bundle 总量偏大** —— 现有构建静态 JS 合计约 22MB（gzip 前），首屏相对路径会拉取数百 KB 关键 JS。
6. **生产构建当前不可用** —— `next build` 因 `mysql2/promise` 解析失败而中止，直接阻塞发版/部署，需单独优先修复。

### 证据
- 生产实测：请求 `/` 首页 HTML 直接引用三个 CSS，其中 `f83b9015a2e1bb78.css` ≈ **884KB（Tailwind v4 全站工具类）**，**每个页面都加载**，是最主要的渲染阻塞资源。
- 既有构建产物 `.next/static/chunks` 顶层大 JS：`778KB / 762KB / 612KB / 608KB / 508KB×2` 等。
- 重依赖（echarts / prosemirror / shiki / mathjax）经全量检索，全部位于 slide-renderer 等懒加载组件与 admin 页，**没有泄漏进首屏 bundle**（健康点，无需动）。
- `animate.css` 相关类名 `animate__*` 与 `.animated` 全局检索命中为 0；命中项均为 lucide 图标名、`animated` 变量、Tailwind 任意值动画，与 animate.css 无关。
- **纠正（实测后）**：884KB 这个全站 CSS 的构成是 Tailwind `@layer` 工具类 + `@source "../node_modules/@maic/renderer/dist/**/*.{js,cjs}"` 扫入的渲染器样式（约 916 个 `maic/sky` 相关类）等，**并非** animate.css/katex。因此移除 animate.css/katex 不会明显缩小该文件——它们是正确性清理，但真正的 LCP 杠杆是这一张全站 Tailwind 样式表（见 3.3）。

---

## 二、P0 —— 阻断问题（先修，1-2 个工日）

### 2.1 生产构建失败：`mysql2/promise` 无法解析
**实测根因**：并非配置/代码问题，而是 `node_modules/mysql2` 的 pnpm junction 指向的目标包目录为**空**——mysql2 依赖安装损坏（仅 mysql2 受影响，其余依赖完好）。Turbopack 因而无法解析 `mysql2` 与 `mysql2/promise`。

**已处置（本次完成）**：删除损坏的空 junction，`pnpm install` 重新拉取，mysql2 恢复为 v3.22.4。`pnpm build` 已验证完整通过（编译 31.4s，静态页 121/121）。

**后续加固建议**：若在无本地存储/CI 场景仍偶发，可将 `mysql2`、`mysql2/promise` 一并显式加入 `serverExternalPackages`，并接入远程构建缓存（见 3.5）。

---

## 三、P1 —— 首屏 CSS 与 JS 体积（收益最大、改动最小）

### 3.1 移除无用的全局 `animate.css`
- 现状：`app/layout.tsx` 全局 `import 'animate.css'`，全项目 0 处使用。
- 改动：**本次已完成**——已从 `app/layout.tsx` 删除该全局 import。
- 实测说明：该文件并不在 884KB 全站 CSS 内（见“证据·纠正”），因此此项是正确性/依赖 hygiene 收益，而非体积杠杆。

### 3.2 将 `katex.min.css` 从全局移入按需路由
- 现状：`app/layout.tsx` 全局 `import 'katex/dist/katex.min.css'`。KaTeX 只用于数学渲染（课堂、数学题、solve 等）。
- 改动：**本次已完成**——从全局移除，改为在三个共享数学渲染组件内按需引入：`components/ui/inline-math.tsx`、`components/sky/solve/math-renderer.tsx`、`components/slide-renderer/components/element/LatexElement/BaseLatexElement.tsx`。
- 效果：无登录态/首页不再无条件携带 KaTeX 样式；数学页面正常渲染。

### 3.3 收敛全站 Tailwind 共享 CSS（**已实测、结论修正**）
**实测结论（2026-09-15）**：
- 首页实际引用 `f83b9015a2e1bb78.css` ≈ **884KB 原始 / gzip 后仅 97KB**（压缩比 11%）。其真实负担是**传输便宜、但未解压解析量大**（低端机主线程解析 ~884KB）。
- 构成拆解：`@layer` 中 utilities ≈ 861KB，是拼**全项目真实工具类 + `:is(.dark *)` dark 变体双份**（1781 处）的合法输出，**无匹配的死代码**；`@source renderer` 是活跃的（dist 存在 204 个 js 文件）。
- 该 CSS 每页加载但被浏览器长期缓存（Next 静态带 immutable），成本是一次性、页面间复用。

**因此**：886KB→更小的安全路径有限（需要路由级 CSS 拆分/懒加载 dark，风险高、传输收益仅~几十 KB gzip），**不建议激进重构**。真正拖慢加载的杠杆应转到 **4.1（TTFB）与 4.2（请求瀑布）与 3.4（首屏 JS）**。若日后仍想压解析成本，再单独立项做路由级 CSS 拆分（把 renderer 类收进 classroom 路由局部）。

**已保留**：上一轮的全局清理仍在收益（animate.css 移除 + katex 按需）虽不是体积主因，但属于正确的样式 hygiene。

### 3.4 审计首屏 JS 依赖（**本次已完成，结论：首屏已健康，无需激进拆包**）
**实测（2026-09-16，基于修复后生产构建）**：

- **首屏实际只拉 19 个脚本**，合计 **1.11MB 原始 / ≈0.39MB gzip**。最大单块是主页主 chunk `ad4effdb5117…`（219KB），其余大多 <150KB。这是当前路由健康、合理的水平。
- **重依赖全部在懒加载 chunk，零泄漏进首屏**：
  - echarts（508KB×2：`b4361c84bc`、`cce0ed3486`）均**不在**首页脚本清单。
  - prosemirror / shiki / mathjax 首屏脚本命中 0。
  - katex 已按 3.2 收进共享数学组件，首屏脚本命中 0。
  - 体积最大的 6 个 vendor chunk（410–778KB）──`ed8313441e`/`3057d6984e`（Geist 字体相关+react/bundle，含 radix/animation）、`28181bacd2`/`0718db04e0` 等──**均不被首页引用**，属按需 code-split。
- **字体**：`Inter`（localFont，全局 `--font-sans`）+ `GeistSans` + `GeistMono`。`GeistMono`（`--font-geist-mono`）在 settings/slides/code-block/prompt-input 等 **30+ 文件真实使用**，**不可移除**；三套字体均经 `next/font` 静态预载为小型 woff2，成本可控，属正常范围。

**结论**：首屏 bundle 结构与体积健康，前端主因（全局 CSS、动态渲染、请求瀑布）已由 3.3/4.1/4.2 处理。**3.4 无需拆包动作**。若日后要压，唯一候选是把非首页懒加载 vendor（尤其 echarts 双份 508KB）核对是否可合并去重，但那是内存/二级缓存维度、不触首屏，收益低，不建议为其上线风险投入。

---

## 四、P1/P2 —— 渲染策略与请求瀑布

### 4.1 取消根布局 `dynamic = 'force-dynamic'`（**本次已完成，已验证**）
- 改动：从 `app/layout.tsx` 移除根级 `force-dynamic`，并用 `<Suspense fallback={null}>` 包裹根布局里的 `OnboardingGate`（其读取 searchParams）。
- 结果：**199 个路由全部静态预渲染**（此前全动态），仅 `/api/*`、`/classroom/[id]`、`/generation-preview`、`/auth/login`、`/sky/teaching*` 等真正依赖运行时状态的路由保持动态。
- 验证：`pnpm build` 通过、199 页预渲染、77 个静态 HTML 落盘、`/sky/cloud-mind/slides` 未认证正确跳转 `/?redirect=...&reason=login_required`（拦截逻辑保留）、首页 HTML katex 引用 0 次（3.2 收益在真机产物中确认）。
- 收益：公开页 TTFB 从"每次服务器实时渲染"降为"读到即回"，可被 CDN 长期缓存。
- 注意：静态化后，公开页 HTML 固定在构建时；登录态/变化数据一律走客户端 API，不受影响。

### 4.2 合并首屏客户端 API 瀑布（**实测结论：生产无瀑布，建议不合并**）
**实测（2026-09-16）**：用无头浏览器在生产服务器上打开首页，捕获全部网络请求。`/api/auth/me`、`/api/server-providers`、`/api/access-code/status` 在加载早期**同批并行发出**，无串行依赖。

**代码证据**：
- `ensureAdminUserClient()` 生产环境立即短路（`NODE_ENV==='production'` 直接 return），不阻塞 `auth/me`。
- 三个 Provider 各自独立 `useEffect` 触发，浏览器本就会并行。
- `fetchServerProviders()` 已有 5 分钟内存缓存 + `fetchInProgress` 并发去重。

**结论**：原计划"把 4-5 次 RTT 压到 1-2 次"的前提不成立——真正阻塞渲染的只有 `auth/me`（登录态是渲染边界必要依赖，静态框架下无法消除），其余请求异步并行、不拖累可交互时间，合并收益≈0 且会引入三套语义的耦合风险。**建议保持现状，不做合并。**

**可选的微观优化（非本次范围，留待日后）**：若仍想省到极致，将 `access-code/status`（每次受保护页导航重发、无缓存）加短 TTL 客户端缓存，但需权衡管理员中途关闭访问码的过期风险，收益有限。

---

## 五、多用户并发卡顿（**内网/教室规模：几人~几十人，单副本**）

### 5.0 现状诊断（**已实测定位，2026-09-16**）
- **部署形态**：单实例单容器（docker-compose 仅一个 `sky_classroom`，单 Node 进程）。
- **真正的元凶是进程内同步重计算压在唯一的事件循环上**，多用户并发时一个任务阻塞、拖慢所有人：
  - `lib/slides/pptx-exporter.ts` / `lib/export/course-exporter.ts` 的 `pres.writeFile()`（jszip 同步打包 PPTX）。
  - `lib/pdf/pdf-providers.ts` 用 `unpdf` 解析 PDF（`extractText`/`extractImages`）。
- **LibreOffice→PNG（`png-converter.ts`）走 `execFile` 子进程，不阻塞事件循环**——不是主因，无需改。
- **已有设施**：各流水线内部有 `withConcurrencyLimit`（限工作项并行、防打爆 provider）；`sky-rate-limiters` 做了每端点限流。
- **缺两样**：(a) 把同步重块挪出主线程；(b) 一个**跨任务的全局并发闸门**（尖峰时多人同时点生成会瞬时全卡）。

### 5.1 方案（推荐首先落地 A，B/C 无需）
| 步骤 | 内容 | 解决哪类卡顿 |
|------|------|--------------|
| **A1** | 将 PPTX 打包 + PDF 解析挪进 Node **`worker_threads`**（新 `lib/server/workers/`，封装 `runInWorker`）。事件循环不被长时间占用 | **多人互相拖累** + **基础页面被拖慢** |
| **A2** | 加一个**全局服务端生成并发闸门**（内存 semaphore，全局同时最多 2~3 个生成流水线，超出排队、返回排队状态），配合已存在的流式轮询 | **点生成时尖峰**：多任务排队而非瞬时打爆 |
| B | 把 job store 抽到共享存储 + 限流器换 Redis（为几十+并发预留） | 横向扩容 |
| C | BullMQ/Redis 全局队列 + 全局并发水位（数百并发才需要） | 极限并发 |

**结论（内网/教室几~几十人）**：仅 **A1 + A2** 即可消除 90% 的"一多人就卡"。B/C 是为更大规模构想的过设计，不投入。基础页面本身慢已由 4.1（静态化）/3.x（CSS 收口）处理；若"多人时基础页面也慢"的感受仍在，根因就是 A1 所述的事件循环被阻塞，归 A1 解决。

### 5.2 落地实况（**已完成验证 2026-09-16**）

| 组件 | 实施 | 验证 |
|------|------|------|
| **A2 并发闸门** | `lib/server/generation-gate.ts`：FIFO semaphore，全局并发上限 `MAX_CONCURRENT=3`、排队上限 `MAX_QUEUE=12`；接入 `pipeline.ts`（排队时更新 job 提示），`generate/route.ts` 队满返回 429 | `tests/server/generation-gate.test.ts`（入队/出队顺序/容量上限） |
| **A1-PDF worker** | `lib/server/workers/pdf-extract.worker.mjs` + `pdf-extract.ts`：`unpdf(jszip/pdf.js)` 文本抽取挪进 `worker_threads`，主线程失败自动回退内联解析 | 真机 `scripts/smoke-pdf-worker.mjs`；生产构建确认 Turbopack 正确发射 `.mjs` worker 资产 |
| **A1-PPTX（保留主线程，不 worker 化）** | 见下方评估 | — |

**PPTX 打包不 worker 化的评估结论（2026-09-16）**：
- 当前生成流水线（`pipeline.ts`）的纯 JS 同步重块只有 `pres.write()`（jszip 打包），量级几十~百 ms，相对 LLM 数分钟的整体耗时可忽略。
- 公式渲染走 `@napi-rs/canvas`（**原生 N-API**），重活落在 libuv 线程池而非 JS 事件循环，不会冻结主线程。
- LibreOffice/PNG 预览（`pptx-preview.ts` → `scripts/pptx-to-images.py`）已是**子进程**，不阻塞。
- A2 闸门已将并发流水线削到 3，jszip 突发被队列削平。
- worker 化需把定制 `pptxgenjs` + 模板渲染树 + `buildThemeFromDesignDNA` + MathJax + `@napi-rs/canvas`（原生模块）整体打进 worker，Turbopack worker 资产发射对如此重的依赖图非常脆弱——**风险/收益比不划算，暂缓**。若后续压测显示公式渲染成为瓶颈，再单独 worker 化 `latex-to-image.ts`（纯函数、自包含，是理想 worker 候选）。

**真机并发压测（`scripts/stress-generation-gate.ts`，tsx 直跑真实闸门）**：20 个模拟用户、峰值 15 个同时点生成——`In-flight` 从未超过上限（峰值=3，恰好封顶）；17 人进入 FIFO 等待；结束后闸门完全排空；主线程事件循环最大卡顿仅 ~19ms（阈值 <150ms）。结论：闸门正确削平尖峰、不越界、不冻主线程，符合教室场景预期。

**尚未完成（非本期）**：`export-pptx` 与 course-export 两条按需导出端点同样调用 `pres.write()`，但属低频用户操作，未单独加闸门（A2 覆盖的是生成流水线）。如需防尖峰，可后续让这两条端点复用 `acquireGenerationSlot`。

---

## 六、P2 —— 长期优化（按需排期）

- **构建缓存**：当前 `next build` 报 `No build cache found`。接入远程构建缓存（或至少本地持久化）可显著缩短发版时长。
- **图片/资源交付**：`images` 已配 AVIF/WebP 与 1 年缓存（健康）。继续确保落地页/工作区封面用 `next/image` + 明确尺寸，避免大图拉高 LCP。
- **拆分超大门户页**：`app/page.tsx` 是超大型客户端组件（约千行，含任务轮询、课堂列表、草稿恢复等）。将“生成任务轮询”逻辑与 UI 解耦、把 `SkyBackground`/`FloatingParticles`/`HeroInput` 等降权重，降低水合成本。
- **云端智囊各页**：其共享同一根布局与全局 CSS，故 P1 完成后将直接受益；若仍有某页独大，再按“按需加载 + 算法/图表懒注入”处理（`echarts` 已在 slide-renderer 内懒加载，保持现状即可）。
- **性能观测**：建议接入简单的 Web Vitals 上报（LCP/FCP/INP/TTFB）与请求瀑布统计，让后续优化有数据闭环，避免“拍脑袋”。

---

## 七、建议执行顺序

| 阶段 | 内容 | 预计收益 | 风险/依赖 |
|------|------|----------|-----------|
| P0 | 修复 `mysql2/promise` 构建失败 | 恢复发版、拿到真实分块表 | 需确认发布链路 |
| P1-3.1 | 移除全局 `animate.css` | 每页 CSS 减 ~93KB | 极低 |
| P1-3.2 | 下移 `katex.min.css` 到数学路由 | 非数学页移除 KaTeX 样式 | 低（需回归数学页样式） |
| P1-3.3 | 收敛 905KB 共享 CSS | 首屏样式解析大幅下降 | 需验证渲染器样式 |
| P1-4.1 | 取消全局 `force-dynamic` + Suspense 化 | 公开页静态化 + CDN 缓存 | 中，需 e2e 回归 |
| P2-4.2 | 合并首屏 API 瀑布 | 可交互时间显著提前 | 中 |
| P2 | 构建缓存 / 门户页拆分 / Web Vitals 观测 | 发版与后续迭代提速 | 低 |

## 八、验收标准（每项做完用真实环境验证）
1. `pnpm build` 成功，无 `mysql2/promise` 报错，输出分块表。
2. 登录页 / 首页 / 云端智囊页的 LCP：较当前下降 ≥ 30%（用 Chrome DevTools 灯塔或 Performance 面板，3G/中等网络）。
3. 全站共享 CSS 单文件体积 < 300KB（目标 ~250KB）。
4. 无登录态公开页 TTFB 命中缓存或明显下降。
5. 首屏网络瀑布中 `auth/me` 之前的非必要请求数量显著减少。
6. 数学渲染、课堂、solve、云端智囊各核心链路 e2e 通过，无样式/水合回归。