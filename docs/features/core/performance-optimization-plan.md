# 天空课堂性能优化实施计划书

> 版本: v1.0 | 日期: 2026-05-28 | 状态: 待审批

---

## 0. 总则与安全红线

### 0.1 优化原则
- **功能零回归**: 所有优化不得改变任何用户可见的行为（UI 展示、交互逻辑、API 响应格式）
- **向后兼容**: localStorage key、API 路径、事件名称一律不变
- **可回滚**: 每个优化独立可 revert，不互相依赖
- **先测后改**: 每个优化实施后必须跑 `pnpm test` + 手动验证关键路径

### 0.2 风险分级
| 级别 | 含义 | 操作要求 |
|------|------|----------|
| 低风险 | 纯配置/替换依赖，无逻辑变更 | 直接实施 |
| 中风险 | 涉及加载时机/异步行为变化 | 需手动验证关键路径 |
| 高风险 | 涉及数据流/状态管理核心 | 需编写回归测试 |

---

## 1. [P0] lodash 替换为轻量实现

**风险**: 低 | **影响文件**: 3 个 | **预计工时**: 30 分钟

### 1.1 现状分析

项目中 3 处 lodash 导入，仅使用 2 个函数：

| 文件 | 函数 | 用途 |
|------|------|------|
| `lib/store/settings.ts` (间接) | - | 无直接导入，通过 slice 使用 |
| `components/slide-renderer/Editor/Canvas/hooks/useSelectElement.ts:2` | `uniq` | 去重选中元素 ID 数组 |
| `components/slide-renderer/components/element/TextElement/index.tsx:4` | `debounce` | 空文本延迟删除 (300ms) |
| `components/slide-renderer/components/element/ProsemirrorEditor.tsx:4` | `debounce` | 输入处理 + 点击处理防抖 |

### 1.2 实施步骤

#### Step 1: 替换 `uniq` (useSelectElement.ts)

```ts
// 修改前 (第 2 行):
import { uniq } from 'lodash';

// 修改后: 删除 lodash import，在第 52 行调用处改为:
setActiveElementIdList([...new Set(newActiveIdList)]);
```

**功能验证**: `new Set` 对字符串数组去重与 `lodash.uniq` 行为完全一致（都保留首次出现的顺序）。此处 `newActiveIdList` 为 `string[]`，完全等价。

#### Step 2: 替换 `debounce` (TextElement/index.tsx)

```ts
// 修改前 (第 4 行):
import { debounce } from 'lodash';

// 修改后:
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number,
  options?: { trailing?: boolean },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (options?.trailing !== false) fn.apply(this, args);
    }, wait);
  } as T;
}
```

**功能验证**: 原调用为 `debounce(fn, 300, { trailing: true })`。手写版本完全覆盖此调用模式（trailing 默认 true）。

#### Step 3: 替换 `debounce` (ProsemirrorEditor.tsx)

```ts
// 修改前 (第 4 行):
import { debounce } from 'lodash';

// 修改后: 复用 Step 2 同一文件内定义的 debounce 函数
// 或将 debounce 提取到 lib/utils/debounce.ts 统一引用
```

**功能验证**: 原调用为 `debounce(fn)` 无参形式（使用默认 300ms）和 `debounce(fn, delay)`。手写版本兼容两种调用。

#### Step 4: 清理 package.json

```diff
  "dependencies": {
-   "lodash": "^4.17.21",
    ...
  }
  "devDependencies": {
-   "@types/lodash": "^4.17.23",
    ...
  }
```

然后执行 `pnpm install` 确认无编译错误。

### 1.3 预期效果

| 指标 | 优化前 | 优化后 | 说明 |
|------|--------|--------|------|
| JS bundle (gzip) | ~+70KB | 0KB | lodash 完全从产物中移除 |
| 首屏解析时间 | +~40ms | 0ms | 减少 JS 解析负担 |
| 运行时行为 | 完全不变 | 完全不变 | `uniq`/`debounce` 行为等价 |

---

## 2. [P0] Next.js 构建优化配置

**风险**: 低 | **影响文件**: `next.config.ts` | **预计工时**: 1 小时

### 2.1 现状分析

当前 `next.config.ts` 仅有 4 项配置：`output`、`transpilePackages`、`serverExternalPackages`、`experimental.proxyClientMaxBodySize`、`headers`。缺少生产环境性能优化。

### 2.2 实施步骤

#### Step 1: 启用图像优化

```ts
const nextConfig: NextConfig = {
  // ... 现有配置保持不变
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1年浏览器缓存
  },
```

**功能验证**: 所有通过 `<Image>` 组件渲染的图片自动转为 AVIF/WebP 格式。不改变图片视觉表现，仅改变传输格式。浏览器自动 fallback 到兼容格式。

**安全红线**: 项目中直接使用 `<img>` 标签的图片不受此配置影响，无需担心。

#### Step 2: 启用 Gzip/Brotli 压缩

```ts
  compress: true,
```

**功能验证**: Next.js 生产模式默认启用压缩，显式声明防止配置覆盖。

#### Step 3: 优化包导入（Tree-shaking 提示）

```ts
  optimizePackageImports: [
    'lucide-react',          // 仅打包使用到的图标
    '@xyflow/react',         // 知识图谱组件
    'motion',                // 动画库
    'embla-carousel-react',  // 轮播组件
    'cmdk',                  // 命令面板
  ],
```

**功能验证**: `optimizePackageImports` 仅作为提示帮助 Next.js 分析哪些模块可以安全 tree-shake，不会改变任何运行时行为。

**安全红线**: 不包含 `echarts` —— 因为 eCharts 的 tree-shaking 已经在 `Chart.tsx:8-21` 中通过 `echarts.use([...])` 手动实现了，不需要也不应该再加到这里。

#### Step 4: 响应缓存头配置

```ts
  async headers() {
    const extraAncestors = process.env.ALLOWED_FRAME_ANCESTORS?.trim();
    const frameAncestors = extraAncestors ? `'self' ${extraAncestors}` : "'self'";

    return [
      // 原有 CSP 配置保持不变
      {
        source: '/(.*)',
        headers: [
          ...(!extraAncestors ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
      // ===== 新增: 静态资源强缓存 =====
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/avatars/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/logos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
```

**功能验证**: 
- `/_next/static/` 下的 JS/CSS 文件自带内容哈希（webpack 自动添加），immutable 缓存绝对安全
- `/avatars/` 和 `/logos/` 头像/logo 资源采用 `stale-while-revalidate`，既保证快速响应，又在后台自动更新

**安全红线**: 不影响任何 API 路由（`/api/*` 不在上述 source 匹配范围内）。

### 2.3 预期效果

| 指标 | 优化前 | 优化后 | 说明 |
|------|--------|--------|------|
| lucide-react bundle | ~全量 | ~按需(5-10%) | 数百个图标只打包用到的几个 |
| 静态资源二次加载 | 每次重新请求 | 浏览器缓存命中 | 1年缓存，跳过网络层 |
| 图片传输体积 | 原始格式 | AVIF/WebP | 通常减少 30-50% |
| motion bundle | 全量 | ~按需 | 只打包使用的动画组件 |

---

## 3. [P0] 重型组件 Code Splitting

**风险**: 中 | **影响文件**: 多处 | **预计工时**: 3 小时

### 3.1 现状分析

以下重型组件当前被同步导入主 bundle：

| 组件 | 预估体积 | 使用场景 | 是否首屏需要 |
|------|----------|----------|:------------:|
| echarts (含 renderer) | ~350KB | 图表元素渲染 | 否 |
| prosemirror-* (全套) | ~200KB | 文本编辑器 | 部分 |
| slide-renderer (80+ 文件) | ~500KB+ | 幻灯片渲染 | 是(核心) |
| @xyflow/react | ~150KB | 知识图谱 | 否 |
| slide-renderer Editor (Canvas) | ~300KB | 幻灯片编辑模式 | 否 |

### 3.2 实施步骤

#### Step 1: 图表组件动态加载

**文件**: `components/slide-renderer/components/element/ChartElement/index.tsx`

```tsx
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton'; // 或自定义 loading

// 动态导入 Chart 组件，仅客户端渲染
const Chart = dynamic(
  () => import('./Chart').then((m) => ({ default: m.Chart })),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full" />,
  },
);

export { Chart };
```

**功能验证**: 
- `ssr: false` 确保 echarts 不在服务端执行（它依赖 DOM API）
- 图表首次出现在视口时才加载，不改变任何渲染结果
- 用户看到的是相同的图表，只是首次出现前有短暂的 skeleton 占位

#### Step 2: 知识图谱动态加载

**文件**: 找到引用 `@xyflow/react` 的知识图谱页面组件

```tsx
import dynamic from 'next/dynamic';

const KnowledgeGraph = dynamic(
  () => import('@/components/sky/knowledge-graph').then((m) => ({ default: m.KnowledgeGraph })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading graph...</div>
      </div>
    ),
  },
);
```

**功能验证**: 知识图谱是独立页面功能，不在首屏加载范围内。延迟加载不影响任何交互。

#### Step 3: Slide Editor (Canvas 编辑模式) 动态加载

Slide Editor 是幻灯片编辑时使用的重型组件（包含 Canvas、Ruler、Operate 等 20+ 子组件）。

```tsx
const SlideEditor = dynamic(
  () => import('@/components/slide-renderer/Editor').then((m) => ({ default: m.SlideEditor })),
  { ssr: false, loading: () => null },
);
```

**功能验证**: 编辑模式是用户主动触发的操作（点击编辑按钮），延迟几百毫秒加载完全无感知。幻灯片播放/预览模式不受影响。

### 3.3 安全红线

**绝对不做 Code Splitting 的组件**:
- `SlideRenderer` (幻灯片播放器) —— 这是核心功能，首屏即可用
- `Chat` / `Conversation` 组件 —— 核心交互路径，不能延迟
- 所有布局组件 (`layout.tsx`) —— 必须同步渲染避免闪烁
- 所有 Store 初始化代码 —— 必须同步保证状态就绪

### 3.4 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 首屏 JS (非课堂页面) | ~1.2MB | ~600-700KB |
| TTI (可交互时间) | ~2-3s | ~1-1.5s |
| echarts 加载时机 | 首屏阻塞 | 用户看到图表时才加载 |
| 知识图谱加载 | 首屏携带 | 进入页面才加载 |

---

## 4. [P0] 字体加载优化

**风险**: 低 | **影响文件**: `app/layout.tsx` | **预计工时**: 20 分钟

### 4.1 现状分析

当前同时加载 3 个字体族：
1. `Inter Variable` (localFont, 从 node_modules 加载, 全字重 100-900)
2. `Geist Sans` (next/font, 通过 npm 包)
3. `Geist Mono` (next/font, 通过 npm 包)

`Inter` 作为 `--font-sans`，`GeistSans` 作为 body 默认字体。两个 sans 字体功能重叠。

### 4.2 实施步骤

#### Step 1: 添加 display: swap 防止 FOIT

```tsx
const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',    // ← 新增
});
```

#### Step 2: 移除冗余的 Inter 字体（推荐）

如果项目中没有专门使用 `--font-sans` (Inter) 的特殊场景，可以简化：

```tsx
// 删除 Inter localFont 导入
// 删除 inter.variable 在 html className 上的引用

// body 直接使用 GeistSans + GeistMono
<body
  className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
  suppressHydrationWarning
>
```

**功能验证**: Geist Sans 覆盖了 Inter 的所有用途（同为无衬线可变字体，字重 100-900）。CSS 中 `font-sans` 类仍正常工作。

**如果保留 Inter 的安全方案**: 至少添加 `display: 'swap'` 和 `preload: true`。

### 4.3 预期效果

| 指标 | 优化前 | 优化后(移除Inter) | 优化后(保留+swap) |
|------|--------|-------------------|-------------------|
| 字体请求数 | 3 个 | 2 个 | 3 个 |
| 字体体积 | ~250KB | ~150KB | ~250KB |
| FOIT 闪烁 | 可能发生 | 不会发生 | 不会发生 |

---

## 5. [P1] 速率限制器内存泄漏修复

**风险**: 低 | **影响文件**: `lib/api/middleware/rate-limiter.ts` | **预计工时**: 30 分钟

### 5.1 现状分析

```ts
// 第 42 行: buckets 是全局 Map，永远不会被清理
const buckets = new Map<string, TokenBucket>();
```

在长时间运行的 Node.js 进程（非 serverless）中，每个唯一的 rate limit key 都会在 `buckets` Map 中创建一个 entry，永远不会删除。随着时间推移，内存持续增长。

### 5.2 实施步骤

#### Step 1: 添加过期清理逻辑

```ts
const buckets = new Map<string, TokenBucket>();

// 新增: 清理过期 bucket (5分钟无活动的 key 自动删除)
const CLEANUP_INTERVAL_MS = 60_000;  // 每分钟清理一次
const MAX_BUCKET_IDLE_MS = 300_000;  // 5分钟无活动视为过期

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > MAX_BUCKET_IDLE_MS) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
```

**功能验证**: 清理逻辑只删除 5 分钟内未被访问的 bucket。正常用户请求不会受影响（每次请求都会更新 `lastRefill`）。

#### Step 2: 添加容量上限保护

```ts
const MAX_BUCKETS = 10_000; // 防止极端情况内存溢出

function consume(key: string): RateLimitResult {
  // 新增: 如果 bucket 数量超过上限，触发紧急清理
  if (buckets.size > MAX_BUCKETS) {
    const entries = Array.from(buckets.entries());
    // 删除最旧的一半
    entries
      .sort((a, b) => a[1].lastRefill - b[1].lastRefill)
      .slice(0, Math.floor(MAX_BUCKETS / 2))
      .forEach(([k]) => buckets.delete(k));
  }
  // ... 原有逻辑不变
}
```

**功能验证**: 紧急清理删除最久未访问的 bucket。被删除的 key 下次访问时会自动重建（从满额度开始），不会导致任何请求被错误拒绝。

### 5.3 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 内存增长 | 持续上升(无上限) | 有上限(~2-5MB) |
| 长期运行稳定性 | 可能 OOM | 稳定 |
| 限流行为 | 不变 | 不变(对活跃用户无影响) |

---

## 6. [P1] ECharts 增量更新优化

**风险**: 低 | **影响文件**: `components/slide-renderer/components/element/ChartElement/Chart.tsx` | **预计工时**: 20 分钟

### 6.1 现状分析

```tsx
// 第 82 行: notMerge: true 表示每次完全重绘图表
chartInstance.current.setOption(option, true);
```

`setOption(option, true)` 的第二个参数 `true` 等价于 `{ notMerge: true }`，即完全丢弃旧配置重新渲染。对于图表数据的小幅变化（如数值更新但图表类型不变），这是不必要的开销。

### 6.2 实施步骤

```tsx
// 修改第 82 行:
// 修改前:
chartInstance.current.setOption(option, true);

// 修改后:
chartInstance.current.setOption(option, { notMerge: false, lazyUpdate: true });
```

**功能验证**:
- `notMerge: false`: 新旧配置合并，只更新变化的部分（如 series data）
- `lazyUpdate: true`: 不立即渲染，等到下一帧统一渲染，减少重绘次数
- 当图表类型、坐标系等根本性变化时（这些在 `getChartOption` 返回的配置中完全不同），`notMerge: false` 仍然能正确处理，因为 eCharts 会自动检测不兼容的配置并自动全量更新

**安全红线**: 如果测试中发现特定场景下图表更新不正确（如饼图切分比例变化后旧数据残留），则需要保留 `notMerge: true` 仅在数据类型变化时才切换。

### 6.3 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 图表数据更新 | 完全重绘(~50-100ms) | 增量更新(~5-15ms) |
| 动画连贯性 | 可能闪烁 | 平滑过渡 |
| 内存分配 | 每次重建 | 复用已有实例 |

---

## 7. [P1] Chat API 消息体限制与反压控制

**风险**: 中 | **影响文件**: `app/api/chat/route.ts` | **预计工时**: 1.5 小时

### 7.1 现状分析

当前 chat 接口接收完整消息历史：
- 无消息数量上限
- `proxyClientMaxBodySize: '200mb'` 过大（chat 不需要 200MB）
- SSE 流无反压控制，客户端网络慢时会无限积压

### 7.2 实施步骤

#### Step 1: 消息数量裁剪

```ts
// 在 POST 函数中，解析 body 后添加:
const MAX_CHAT_MESSAGES = 50;
const messages = body.messages.length > MAX_CHAT_MESSAGES
  ? body.messages.slice(-MAX_CHAT_MESSAGES)
  : body.messages;
```

然后将 `messages` 传递给 `statelessGenerate` 而不是 `body.messages`。

**功能验证**: 保留最近 50 条消息。更早期的对话历史通过已有的 conversation-summary 机制压缩。不改变 AI 回复质量（最近 50 条足够维持上下文连贯性）。

#### Step 2: SSE 反压控制

```ts
// 在 SSE 流循环中添加反压检测:
const MAX_QUEUE_SIZE = 50;
let pendingWrites = 0;
let droppedCount = 0;

for await (const event of generator) {
  if (signal.aborted) break;

  // 反压: 如果积压事件超过阈值，丢弃非关键事件
  if (pendingWrites > MAX_QUEUE_SIZE) {
    if (event.type !== 'text-delta') continue; // 只保留文本
    if (droppedCount === 0) {
      // 发送一次丢弃通知
      const dropEvent: StatelessEvent = {
        type: 'info',
        data: { message: 'Network slow, some events skipped' },
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(dropEvent)}\n\n`));
    }
    droppedCount++;
    continue;
  }

  pendingWrites++;
  writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    .finally(() => { pendingWrites--; });
}
```

**功能验证**: 当客户端接收速度跟不上服务端生成速度时，自动丢弃 tool-call 等非关键事件，只保留文本内容。用户看到的是完整文本回复，只是少了工具调用的中间事件。

#### Step 3: 调整 maxDuration

```ts
// 将 maxDuration 从 60 改为更合理的值
export const maxDuration = 120; // 允许更长的 AI 响应时间
```

**注意**: 如果部署在 Vercel Hobby 计划上，maxDuration 上限是 60s。如果是 Pro/Enterprise，可以设为 120s 或更高。

### 7.3 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 长对话请求体 | 无上限(可数MB) | ~50条(~200KB) |
| SSE 积压 | 无限增长 | 上限50个事件 |
| 慢客户端 OOM | 可能 | 不会发生 |
| JSON 解析时间 | 随对话增长线性增加 | 恒定(~5ms) |

---

## 8. [P1] Supabase 数据库索引优化

**风险**: 低 | **影响文件**: 数据库 DDL | **预计工时**: 15 分钟

### 8.1 现状分析

`supabase-provider.ts` 中的查询：
- `getAll(table)` — 全表扫描 `table_name` 列
- `get(table, id)` — 复合条件查询 `table_name + id`
- `getByEmail(email)` — `ilike` 模糊匹配（不走索引）
- `getByGuestId(guestId)` — 等值匹配

当前没有看到显式的索引创建迁移。

### 8.2 实施步骤

创建数据库迁移文件:

```sql
-- storage_entries 表索引
CREATE INDEX IF NOT EXISTS idx_storage_table_name ON storage_entries(table_name);
CREATE INDEX IF NOT EXISTS idx_storage_table_id ON storage_entries(table_name, id);

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_guest_id ON users(guest_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_plan_type ON users(plan_type);
```

**功能验证**: 索引只影响查询计划，不改变任何查询结果。`ilike` 查询使用 `LOWER()` 函数索引可以在 PostgreSQL 中命中。

### 8.3 预期效果

| 查询 | 优化前 | 优化后 |
|------|--------|--------|
| getAll(storage) | 全表扫描(~50-200ms) | 索引扫描(~1-5ms) |
| getByEmail | 全表扫描(~50-200ms) | 索引扫描(~1-3ms) |
| getByGuestId | 全表扫描(~50-200ms) | 索引扫描(~1ms) |

---

## 9. [P1] fetchServerProviders 缓存优化

**风险**: 中 | **影响文件**: `lib/store/settings.ts` | **预计工时**: 1 小时

### 9.1 现状分析

`fetchServerProviders` 是 settings store 中最重的操作（~450 行代码，处理 7 种 provider 类型的合并/验证/自动选择）。每次 store 初始化时都可能被调用，且每次都会发起 `/api/server-providers` 网络请求。

### 9.2 实施步骤

#### Step 1: 添加请求结果缓存

```ts
// 在 store 外部添加缓存
let serverProvidersCache: {
  data: unknown;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 300_000; // 5分钟缓存

// 在 fetchServerProviders 函数中:
fetchServerProviders: async () => {
  try {
    // 检查缓存
    const now = Date.now();
    if (serverProvidersCache && now - serverProvidersCache.timestamp < CACHE_TTL_MS) {
      // 使用缓存数据执行合并逻辑，不发起网络请求
      const data = serverProvidersCache.data;
      // ... 原有合并逻辑不变，使用缓存的 data
      return;
    }

    const res = await fetch('/api/server-providers');
    if (!res.ok) return;
    const data = await res.json();

    // 缓存结果
    serverProvidersCache = { data, timestamp: Date.now() };

    // ... 原有合并逻辑不变
  } catch (e) {
    log.warn('Failed to fetch server providers:', e);
  }
},
```

#### Step 2: 添加并发防护

```ts
// 防止多个组件同时调用 fetchServerProviders 导致重复请求
let fetchInProgress = false;

fetchServerProviders: async () => {
  if (fetchInProgress) return; // 已有请求在进行，直接返回
  fetchInProgress = true;
  try {
    // ... 原有逻辑
  } finally {
    fetchInProgress = false;
  }
},
```

**功能验证**: 5 分钟缓存期内不会重复请求。并发防护防止同一时刻多个请求。用户刷新页面后缓存失效，重新获取最新配置。

**安全红线**: 缓存 key 在模块作用域，不跨用户/会话。server-providers 返回的是全局配置（provider 列表），不是用户私有数据。

### 9.3 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 页面加载网络请求 | 每次加载都请求 | 5分钟内缓存命中 |
| settings store 初始化 | ~100-300ms | ~5ms (缓存命中时) |
| 并发请求 | 可能重复 | 防护后只发一次 |

---

## 10. [P2] middleware.ts 优化或移除

**风险**: 低 | **影响文件**: `middleware.ts` | **预计工时**: 10 分钟

### 10.1 现状分析

```ts
// middleware.ts — 空操作但仍然匹配所有路由
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/|avatars/).*)'],
};
```

每个非静态资源请求都会触发 middleware 执行（即使只是调用 `NextResponse.next()`），产生 ~1-2ms 的额外开销。

### 10.2 实施步骤

#### 方案 A: 暂时移除（推荐）

```ts
// 直接删除 middleware.ts 文件
// 或将其内容改为空导出
export {};
```

**前提**: 确认当前没有依赖 middleware 的功能（如认证检查、A/B 测试、地域路由等）。查看代码确认 `AccessCodeGuard` 是客户端组件，不依赖 middleware。

#### 方案 B: 缩小匹配范围

```ts
export const config = {
  matcher: ['/api/:path*', '/classroom/:path*'],
  // 只匹配需要 middleware 的路径
};
```

### 10.3 预期效果

| 指标 | 优化前 | 优化后(移除) |
|------|--------|-------------|
| 每个请求延迟 | +1-2ms | 0ms |
| Edge 函数调用 | 每次 | 无 |

---

## 11. [P2] animate.css 按需加载

**风险**: **高** | **影响文件**: `app/layout.tsx` | **预计工时**: 2 小时

### 11.1 ⚠️ 风险评估

`animate.css` 被全局导入 (`app/layout.tsx:6`)，提供 ~100+ 个动画类的 CSS。项目中的幻灯片元素动画使用 `animate__${animationName}` 格式动态应用这些类。

**关键发现**: `configs/animation.ts` 定义了完整的动画列表配置（ENTER/EXIT/ATTENTION 动画），这些都是通过 `animate__` 前缀拼接类名在运行时动态应用的。

### 11.2 建议方案

#### 方案 A: 保留完整 animate.css（推荐用于当前阶段）

理由：
- 动画类是动态拼接的（`animate__bounceIn`、`animate__fadeIn` 等），无法静态分析哪些被实际使用
- 幻灯片是核心功能，任何动画缺失都会直接可见
- animate.css gzip 后约 ~70KB，对整体 bundle 影响可控

**结论**: 暂不动此文件，优先级降低。

#### 方案 B: 提取实际使用的动画子集（需后续分析）

步骤：
1. 在运行中的应用中收集所有实际使用的 `animate__*` 类名
2. 只复制这些类的 CSS 到 `globals.css`
3. 移除 `import 'animate.css'`

**风险提示**: 需要确保没有遗漏任何动画类。建议在充分测试后执行。

### 11.3 预期效果

| 指标 | 优化前 | 方案A | 方案B |
|------|--------|-------|-------|
| CSS 体积 | ~70KB gzip | ~70KB (不变) | ~10-20KB gzip |
| 动画功能 | 完整 | 完整 | 完整(需验证) |
| 实施风险 | - | 零 | 中 |

---

## 12. [P2] 构建产物分析与监控

**风险**: 无 | **预计工时**: 30 分钟

### 12.1 实施步骤

#### Step 1: 安装 bundle 分析工具

```bash
pnpm add -D @next/bundle-analyzer
```

#### Step 2: 添加分析脚本到 package.json

```json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  }
}
```

#### Step 3: 在 next.config.ts 中启用

```ts
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  // ... 现有配置
};

export default process.env.ANALYZE
  ? withBundleAnalyzer({ enabled: true })(nextConfig)
  : nextConfig;
```

**效果**: 运行 `pnpm analyze` 生成可视化 bundle 报告，清晰展示每个包的体积占比。每次优化后重新运行，量化效果。

---

## 实施顺序建议

```
阶段一 (第1天): 低风险高收益
├── 1. lodash 替换          (30min, 低风险)
├── 2. Next.js 配置优化     (1h,   低风险)
├── 5. 速率限制器修复       (30min, 低风险)
├── 6. ECharts 增量更新     (20min, 低风险)
├── 8. DB 索引添加          (15min, 低风险)
└── 10. middleware 移除     (10min, 低风险)

阶段二 (第2天): 中等风险中收益
├── 3. Code Splitting       (3h,   中风险)
├── 7. Chat API 反压        (1.5h, 中风险)
├── 9. fetchServerProviders (1h,   中风险)
└── 4. 字体优化             (20min, 低风险)

阶段三 (后续): 持续优化
├── 11. animate.css 子集    (需分析)
└── 12. Bundle 分析工具     (30min)
```

---

## 验证检查清单

每个优化完成后必须通过以下检查：

### 通用检查
- [ ] `pnpm build` 成功（无 TypeScript 错误）
- [ ] `pnpm test` 通过（无测试失败）
- [ ] `pnpm lint` 通过（无 lint 错误）
- [ ] 开发模式 (`pnpm dev`) 页面正常渲染

### 功能检查
- [ ] **首页**: 页面加载正常，无控制台错误
- [ ] **课堂页面**: 幻灯片正常播放，动画正常
- [ ] **Chat**: 发送消息正常响应，SSE 流正常
- [ ] **设置面板**: Provider 配置正常加载和保存
- [ ] **幻灯片编辑**: Canvas 编辑器正常操作
- [ ] **知识图谱**: 图谱交互正常

### 性能检查
- [ ] Chrome DevTools Network 面板: 首屏资源加载时间缩短
- [ ] Chrome DevTools Lighthouse: Performance 分数提升
- [ ] Bundle 分析工具: 目标包体积确实减少

---

## 回滚预案

如果任何优化上线后出现问题：

| 优化项 | 回滚方式 |
|--------|----------|
| 1. lodash | `git revert` 恢复 import，重新 `pnpm install` |
| 2. next.config | 删除新增配置项，保留原有配置 |
| 3. Code Splitting | 将 dynamic import 改回静态 import |
| 4. 字体 | 恢复 Inter 导入和 variable 引用 |
| 5. rate-limiter | 删除 setInterval 和 MAX_BUCKETS 逻辑 |
| 6. ECharts | 恢复 `setOption(option, true)` |
| 7. Chat API | 移除消息裁剪和反压代码 |
| 8. DB 索引 | `DROP INDEX` 删除新增索引 |
| 9. fetchServerProviders | 移除缓存逻辑 |
| 10. middleware | 恢复原文件 |

---

*本文档应在实施过程中持续更新。每项优化完成后，在对应章节标注完成时间和实际效果数据。*
u
---

## A. 高并发场景深度分析 — "如果大量用户同时用一个功能会怎样?"

### A.1 当前架构单点分析

根据代码审计，当前部署架构是: **单 Node.js 进程 (Docker standalone 模式)**。

```
Dockerfile → node server.js (单个进程, 无 cluster, 无 worker threads)
```

这意味着所有用户的请求都跑在同一个 Node.js 事件循环上。

### A.2 具体场景: 50 个用户同时触发"生成课堂"

#### 会发生什么:

```
用户 1 ──┐
用户 2 ──┤
用户 3 ──┤
  ...    ├──→ POST /api/generate-classroom (同一 Node 进程)
用户 49 ─┤
用户 50 ─┘
```

1. **请求排队**: 50 个请求同时到达，`generate-classroom/route.ts` 的 `POST` 函数被并行调用 50 次
2. **`after()` 启动后台任务**: 每个请求通过 `after(() => runClassroomGenerationJob(...))` 在后台启动 AI 生成
3. **关键瓶颈 — 文件系统 Job Store**: `classroom-job-store.ts` 用 `writeJsonFileAtomic` 存储每个 job 的状态。每个进度更新 = `read JSON → merge → write temp → fs.rename`。50 个并发 job 意味着:
   - 每个 job 每几秒更新一次进度 → 50 个 job × 每秒 ~0.5 次更新 = ~25 次磁盘写入/秒
   - 所有写入通过 `withJobLock` mutex 串行化（同 job 不冲突，但不同 job 共享磁盘 I/O）
   - 磁盘 IOPS 成为瓶颈，`writeJsonFileAtomic` 延迟从 ~5ms 飙升至 ~100ms+
4. **AI 调用不受控**: `runningJobs` Map 只防止同 job 重复执行，**不限制并发 job 总数**。50 个 job = 50 个并发 LLM API 调用。如果每个调用占用 ~2MB 内存（stream buffer + 上下文），就是 100MB 额外内存。
5. **客户端轮询风暴**: `classroom-job-poller.tsx` 每 2 秒轮询一次。50 个用户 = 每秒 25 次 `GET /api/generate-classroom/[jobId]` 请求，每次都是一次 `fs.readFile`。

**结论**: 系统不会崩溃，但会显著变慢。磁盘 I/O 成为首要瓶颈，其次是 AI API 调用的并发数。

#### 修复方案 (按优先级):

| 修复 | 难度 | 效果 | 说明 |
|------|------|------|------|
| **A. Job Store 改内存 + 定期刷盘** | 中 | 消除 90% 磁盘写入 | 进度更新先写内存 Map，每 5 秒批量刷盘。轮询读内存即可 |
| **B. 并发 Job 限流** | 低 | 防止 LLM 调用过载 | 同时最多运行 5 个生成 job，超出排队 |
| **C. 轮询改为 SSE/长轮询** | 中 | 消除轮询风暴 | 客户端订阅一个 SSE stream，服务端只在状态变化时推送 |
| **D. 迁移到 Redis + PostgreSQL** | 高 | 真正生产级 | 文件存储 → Redis 缓存 + PG 持久化 |

**方案 A 实施步骤** (推荐先行):

```ts
// lib/server/job-store-hybrid.ts
// 内存中的 job 状态，定期刷盘

const inMemoryJobs = new Map<string, ClassroomGenerationJob>();
const dirtyJobs = new Set<string>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

const FLUSH_INTERVAL_MS = 5000; // 每 5 秒刷一次

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(async () => {
    const toFlush = [...dirtyJobs];
    dirtyJobs.clear();
    for (const jobId of toFlush) {
      const job = inMemoryJobs.get(jobId);
      if (job) {
        await writeJsonFileAtomic(jobFilePath(jobId), job).catch(() => {
          dirtyJobs.add(jobId); // 刷盘失败，标记为 dirty 下次重试
        });
      }
    }
  }, FLUSH_INTERVAL_MS);
}

// 读取: 优先内存，fallback 到磁盘
export async function readClassroomGenerationJobHybrid(jobId: string) {
  if (inMemoryJobs.has(jobId)) return inMemoryJobs.get(jobId)!;
  // Fallback: 从磁盘读取并载入内存
  const diskJob = await readClassroomGenerationJob(jobId);
  if (diskJob) inMemoryJobs.set(jobId, diskJob);
  return diskJob;
}

// 写入: 写内存 + 标记 dirty
export async function updateClassroomGenerationJobHybrid(
  jobId: string,
  patch: Partial<ClassroomGenerationJob>,
) {
  const existing = await readClassroomGenerationJobHybrid(jobId);
  if (!existing) throw new Error(`Job not found: ${jobId}`);

  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  inMemoryJobs.set(jobId, updated);
  dirtyJobs.add(jobId);

  startFlushTimer();
  return updated;
}
```

**安全红线**: 这个改动只改变存储时序，不改变任何数据格式或 API 响应格式。即使进程崩溃，最多丢失 5 秒内的进度更新（不影响已完成的 job）。

### A.3 具体场景: 100 个用户同时使用 Chat

```
100 个并发 SSE 连接 → 每个连接调用 LLM API → 同一 Node 进程
```

**当前代码**: `app/api/chat/route.ts` — 每个请求创建一个 `TransformStream` + 后台 async generator。

**瓶颈分析**:
- **LLM API 并发**: 100 个并发 LLM 调用，如果你的 provider 有 rate limit（如 OpenAI 的 RPM 限制），会被限流
- **内存**: 每个 SSE 连接占用 ~500KB-2MB (stream buffer + 上下文)。100 个 = 50-200MB
- **事件循环**: Node.js 单线程处理 100 个 SSE writer，`writer.write()` 是异步的，不阻塞事件循环，但 GC 压力增大

**修复方案**:

| 修复 | 难度 | 效果 |
|------|------|------|
| **A. Chat 并发限流** | 低 | 同时最多处理 N 个 chat 请求，超出返回 429 |
| **B. 消息历史裁剪** | 低 | 限制 body.messages 最多 50 条 (已在第 7 项) |
| **C. SSE 反压** | 中 | 防止慢客户端积压 (已在第 7 项) |

**方案 A — Chat 并发限流**:

```ts
// lib/server/middleware/chat-concurrency.ts
let activeChatConnections = 0;
const MAX_CONCURRENT_CHATS = 20; // 根据服务器能力调整

export function checkChatConcurrency(): { allowed: boolean; active: number } {
  if (activeChatConnections >= MAX_CONCURRENT_CHATS) {
    return { allowed: false, active: activeChatConnections };
  }
  activeChatConnections++;
  return { allowed: true, active: activeChatConnections };
}

export function releaseChatConnection() {
  activeChatConnections = Math.max(0, activeChatConnections - 1);
}

// 在 chat/route.ts 中使用:
export async function POST(req: NextRequest) {
  const check = checkChatConcurrency();
  if (!check.allowed) {
    return NextResponse.json(
      { error: 'Too many active conversations. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': '10' } }
    );
  }

  try {
    // ... 原有逻辑
  } finally {
    releaseChatConnection();
  }
}
```

### A.4 总结: 高并发防御矩阵

```
                    50并发课堂生成          100并发Chat         轮询风暴
                    ───────────────        ──────────         ────────
磁盘 I/O            ████ 严重瓶颈          ░░ 无影响           ████ 严重瓶颈
内存                ██ 可接受             ███ 需关注           ░░ 无影响
LLM API RateLimit   ███ 需限流            ████ 需限流          ░░ 无影响
响应延迟            ████ 显著变慢          ██ 轻微变慢          ████ 显著变慢

解决方案优先级:
1. Hybrid Job Store (解决磁盘 I/O)     → 实施 A.2 方案 A
2. 并发限流 (保护 LLM API)           → 实施 A.3 方案 A + 第 5 项
3. SSE 轮询改推送 (消除轮询风暴)      → 实施 A.2 方案 C
4. 内存安全网 (防止 OOM)             → 第 5 项速率限制器修复
```

---

## B. 页面跳转性能分析 — "跳转页面会不会变慢?"

### B.1 当前架构: 页面跳转机制

Next.js App Router 的页面跳转是 **客户端路由 (Client-Side Navigation)**:

```
用户点击 Link → Next.js 拦截 → 只加载新页面的 JS chunk → 替换 <body> 内容
                  ↑
              不需要重新加载 HTML/CSS/JS shell
```

**好消息**: Next.js 自动按页面代码分割。`/sky/slides` 的 JS 不会在 `/` 首页加载。

### B.2 会影响页面跳转速度的因素

#### 1. 首屏 JS 过大 → 首次加载慢，但后续跳转不受影响

当前问题: 如果 `echarts`、`prosemirror` 等重型库被打进了公共 chunk (shared chunk)，那**所有页面**的首次加载都会变慢。

**验证方法**: 运行 `pnpm build` 后查看 `.next/static/chunks/` 目录，检查:
- 公共 chunk (`main-app.js`, `webpack.js`, `polyfills.js`) 的大小
- 页面专属 chunk (`page-xxx.js`) 的大小

如果 echarts 出现在公共 chunk 中 → 需要 Code Splitting (第 3 项)。

#### 2. 没有 prefetch → 首次跳转有延迟

Next.js 的 `<Link>` 组件默认在链接进入视口时 prefetch 目标页面的 chunk。如果项目中使用 `router.push()` 而不是 `<Link>`，就不会 prefetch。

**检查**: 项目中 navigation 的使用方式。

#### 3. 全局 Provider 初始化开销

`app/layout.tsx` 中嵌套了多层 Provider:
```
ThemeProvider → AuthProvider → ServerProvidersInit → SkyClassroomEntry → KagamiPanel → ClassroomJobPoller → AccessCodeGuard
```

每个 Provider 初始化都需要时间。`ClassroomJobPoller` 挂载后立即开始轮询 (每 2 秒)，即使当前用户没有任何 job。

**优化**: `ClassroomJobPoller` 应该只在有活跃 job 时才开始轮询:

```tsx
// 当前: 挂载就立即轮询
useEffect(() => {
  poll();
  timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
  ...
}, [pathname, router]);

// 优化: 只在有活跃 job 时轮询
useEffect(() => {
  const entries = getActiveJobEntries();
  if (entries.length === 0) return; // 没有活跃 job，不轮询

  poll();
  timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
  ...
}, [pathname, router]);
```

#### 4. CSS 阻塞渲染

`globals.css` 通过 `@import` 导入 Tailwind + tw-animate-css + shadcn，再加上 `animate.css` 和 `katex.min.css`。这些都在 `<head>` 中，阻塞首次渲染。

**现状可接受**: 这些 CSS 文件会被 Next.js 内联和优化。如果 gzip 后 < 50KB，影响很小。

### B.3 页面跳转速度预期

| 场景 | 当前状态 | 优化后 | 说明 |
|------|----------|--------|------|
| 首页 → 首页 (首次) | ~1-2s | ~0.5-1s | 优化 1+2+3+4 后 |
| 首页 → 设置 (首次) | ~200-500ms | ~100-200ms | 减少公共 chunk 后 |
| 设置 → 课堂 (首次) | ~200-500ms | ~100-300ms | Code Splitting 后 |
| 页面间重复跳转 | ~50-100ms | ~50-100ms | 已缓存，基本不变 |

**关键结论**: 页面跳转速度**不会因为高并发用户变慢**，因为 Next.js 的客户端路由走的是浏览器端的 JS chunk 加载，与服务端并发无关。只有首次加载受服务端响应时间影响。

### B.4 不影响功能的安全保障

| 优化 | 对跳转的影响 | 对功能的影响 |
|------|:-----------:|:-----------:|
| lodash 替换 | 无 | 无 — 行为等价 |
| Next.js 配置 | 仅加速 | 无 — 纯配置 |
| Code Splitting | 首次访问某页面多 ~100-300ms | 无 — 用户感知不到 (有 loading) |
| 字体优化 | 首次加载更快 | 无 — Geist 覆盖 Inter 用途 |
| Hybrid Job Store | 无 | 无 — 只改变存储时序 |
| Chat 并发限流 | 无 | 无 — 限流时返回 429，前端可提示排队 |
| ECharts 增量 | 无 | 无 — 图表更新更平滑 |

---

## C. 实施决策矩阵

基于你的关注点，以下是按场景优先级的实施建议:

### 场景 1: 预期会有大量用户同时使用课堂生成功能
```
优先实施: A.2 (Hybrid Job Store) → A.4 (并发限流) → 5 (速率限制器修复)
原因: 这三个解决高并发下的核心瓶颈 — 磁盘 I/O、LLM 并发、内存泄漏
```

### 场景 2: 预期会有大量用户同时使用 Chat 功能
```
优先实施: A.3 (Chat 并发限流) → 7 (消息裁剪+反压) → 5 (速率限制器修复)
原因: 保护 LLM API 不被打爆，防止慢客户端拖垮服务端
```

### 场景 3: 主要是页面加载慢，但用户不多
```
优先实施: 1 (lodash) → 2 (Next.js 配置) → 3 (Code Splitting) → 4 (字体)
原因: 这些是纯前端优化，与并发无关，直接减少首屏加载时间
```

### 场景 4: 全部都关心 (推荐路线)
```
第 1 天 (低风险打底):
  → 1. lodash 替换
  → 2. Next.js 配置
  → 5. 速率限制器修复
  → A.2 Hybrid Job Store (最重要的高并发修复)

第 2 天 (中风险增强):
  → 3. Code Splitting
  → A.3 Chat 并发限流
  → 7. Chat API 反压
  → B.3 Poller 优化

第 3 天 (完善):
  → 6. ECharts 增量
  → 8. DB 索引
  → 9. fetchServerProviders 缓存
  → 4. 字体优化
  → 12. Bundle 分析
```
