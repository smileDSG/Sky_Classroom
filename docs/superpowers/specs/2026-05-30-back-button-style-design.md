# 返回首页按钮样式统一设计

## 背景

当前项目中 PPT 课件生成的两个页面（`generation-preview` 和 `generation-progress`）的"返回首页"按钮样式不一致：
- `generation-preview`: 左上角 ghost 按钮，小号，有动画
- `generation-progress`: 顶部文字链接，灰色，无按钮边框

用户希望统一两个页面的按钮风格，提升用户体验。

## 设计方案

### 按钮样式

统一采用半透明背景风格：

```tsx
<button
  onClick={goBackToHome}
  className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-xl 
             bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm 
             border border-gray-200/50 dark:border-gray-700/50
             px-4 py-2.5 text-sm font-medium 
             text-gray-700 dark:text-gray-200 
             shadow-sm hover:bg-white dark:hover:bg-slate-800 
             hover:shadow-md transition-all duration-200"
>
  <ArrowLeft className="h-4 w-4" />
  返回首页
</button>
```

### 样式说明

| 属性 | 值 | 说明 |
|------|-----|------|
| 位置 | `fixed top-4 left-4 z-50` | 固定在左上角，滚动时始终可见 |
| 背景 | `bg-white/80 dark:bg-slate-800/80` | 半透明白色/深色 |
| 毛玻璃 | `backdrop-blur-sm` | 背景模糊效果 |
| 边框 | `border border-gray-200/50 dark:border-gray-700/50` | 浅灰色圆角边框 |
| 圆角 | `rounded-xl` | 大圆角 |
| 阴影 | `shadow-sm` → `hover:shadow-md` | 悬停时阴影加深 |
| 过渡 | `transition-all duration-200` | 平滑过渡动画 |

### 修改范围

1. **`app/generation-preview/page.tsx`**
   - 修改左上角返回按钮样式
   - 保留 `motion.div` 淡入动画

2. **`app/generation-progress/page.tsx`**
   - 修改顶部返回按钮样式
   - 从 header 布局中移出，改为固定定位

## 验证标准

- [ ] 两个页面按钮样式完全一致
- [ ] 按钮在滚动时始终可见
- [ ] 深色模式下样式正常
- [ ] 悬停效果正常
- [ ] 点击功能正常（返回首页）
