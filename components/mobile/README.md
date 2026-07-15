# Mobile Foundation

该目录包含移动端基础组件与 Hooks，供 队员B 在实现各业务页面时直接使用。

## 归属

- 队员A 负责维护：
  - `components/mobile/shell/*`
  - `components/mobile/ui/*`
  - `components/mobile/hooks/*`
  - `lib/mobile/*`
  - `components/sky/layout/app-shell.tsx`
  - `app/auth/*` 与 `app/account/page.tsx` 的移动端适配

- 队员B 负责维护：
  - 业务页面本身
  - 业务数据流、状态管理与 API 调用

> 如果现有移动端组件无法满足业务需求，请联系 队员A 扩展共享组件，**不要在业务页面里复制一份移动端 UI 代码**。

## 页面容器

使用 `MobilePage` 包裹业务内容，它会自动处理安全区、底部导航留白与标题样式：

```tsx
import { MobilePage } from "@/components/mobile";

export default function LearningPage() {
  return (
    <MobilePage title="个性化学习工作台" description="今日推荐">
      {/* 业务内容 */}
    </MobilePage>
  );
}
```

## 底部面板

在移动端需要展示二级内容或操作时，优先使用 `MobileSheet`：

```tsx
import { MobileSheet } from "@/components/mobile";

<MobileSheet open={open} onOpenChange={setOpen} title="筛选">
  {/* 内容 */}
</MobileSheet>;
```

## 置信度与复核

展示 AI 结果的可信度：

```tsx
import { MobileConfidenceBadge } from "@/components/mobile";

<MobileConfidenceBadge value={0.82} />;
```

- `value >= 0.7` 显示“可信”。
- `value < 0.7` 显示“需复核”。

## 来源引用

展示检索到的来源或引用：

```tsx
import { MobileSourceList } from "@/components/mobile";

<MobileSourceList
  sources={[{ title: "人工智能导论 第一章", excerpt: "机器学习基础" }]}
/>;
```

## Agent 进度

展示多阶段生成进度：

```tsx
import { MobileAgentProgress } from "@/components/mobile";

<MobileAgentProgress
  stages={[
    { id: "profile", label: "画像分析", status: "done" },
    { id: "generate", label: "资源生成", status: "active" },
  ]}
/>;
```

## 空态与错误态

```tsx
import { MobileEmptyState, MobileErrorState } from '@/components/mobile';

<MobileEmptyState title="暂无资源" description="稍后再试" />
<MobileErrorState title="加载失败" description="网络错误" />
```

## 上传按钮

移动端拍照或选择文件：

```tsx
import { MobileUploadButton } from "@/components/mobile";

<MobileUploadButton
  variant="camera"
  label="拍照上传"
  onChange={(files) => console.log(files)}
/>;
```

## 响应式判断

如果业务组件需要感知是否在移动端视口：

```tsx
import { useIsMobile, useMobileViewport } from "@/components/mobile";

const isMobile = useIsMobile();
const { width, height, orientation } = useMobileViewport();
```
