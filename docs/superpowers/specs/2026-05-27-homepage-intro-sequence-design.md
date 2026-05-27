---
title: Homepage Intro Sequence Design
date: 2026-05-27
---

# Homepage Intro Sequence — Design Spec

## Purpose

在用户进入首页前播放一段 ~5.5 秒的奇幻开场动画：山顶剪影 → 云带人上升 → 钻入发光大书 → 白光铺满 → 显示主页。每次访问都播放，用户可随时跳过。

## Architecture

### New Component: `IntroSequence`

**Location:** `components/sky/home/intro-sequence.tsx`

全屏遮罩组件，覆盖在 `HomePage` 之上。动画结束后自动卸载，主页内容可见。

### Integration: `app/page.tsx`

```tsx
const [introDone, setIntroDone] = useState(false);
// ...
{!introDone && <IntroSequence onComplete={() => setIntroDone(true)} />}
{introDone && <HomePage />}
```

## Scene Timeline

### Scene 1 (0-1.5s): 山顶剪影

| 元素 | 视觉 | 动画 |
|------|------|------|
| 天空背景 | 深蓝 → 暖橙日落渐变 | `initial: opacity 0 → animate: 1`, 500ms |
| 山脉剪影 | SVG `<path>` 底部深色三角形 | `initial: y 50 → animate: y 0`, 800ms |
| 人物剪影 | 山顶小圆头 + 细身体 | `initial: opacity 0 → animate: 1`, delay 300ms |
| 云朵剪影 | 扁平椭圆 + 半圆凸起 | `initial: x -20 → animate: x 0`, delay 500ms |

天空渐变色值：`#1a1a2e → #16213e → #e94560` → 第二阶段过渡到 `#667eea → #764ba2`

### Scene 2 (1.5-3s): 云带人上升

| 元素 | 动画 |
|------|------|
| 云朵组 (云 + 人) | `y: 0 → y: -200px`, 1500ms, ease-in-out |
| 人物 | 随云组上升，同时 `scale: 1 → 0.6, opacity: 1 → 0.5` |
| 天空 | 渐变变亮（背景色 transition） |
| 山脉 | `opacity: 1 → 0.3`（渐隐，焦点转移） |

### Scene 3 (3-4.5s): 发光大书

| 元素 | 动画 |
|------|------|
| 书本轮廓 | `scale: 0 → 1, opacity: 0 → 1`, 600ms, delay 200ms |
| 光芒 | radial-gradient 从书中心扩散，`scale: 0 → 3`, 800ms |
| 书页翻动 | 左右页交替 `rotateY: 0 → -10deg → 0`, 500ms |
| 人物消失 | 钻入书中心，`scale: 0.6 → 0, opacity: 0.5 → 0` |

书本 SVG：打开的书形状，白色描边 2px，背后加 `filter: drop-shadow(0 0 20px rgba(255,255,255,0.8))`

### Scene 4 (4.5-5.5s): 白光过渡

| 元素 | 动画 |
|------|------|
| 白色圆形遮罩 | `clipPath: circle(0% at center) → circle(150% at center)`, 1000ms |
| 所有场景元素 | `opacity → 0` |

遮罩铺满后 200ms，触发 `onComplete()` 回调，卸载动画组件。

## Skip Button

- 位置：右下角 (`position: fixed; bottom: 24px; right: 24px`)
- 样式：半透明圆角按钮，"跳过 →" 文字
- 行为：立即触发 `onComplete()`，跳过剩余动画

## Error Handling

- 如果用户设备性能较差导致动画卡顿，Skip 按钮保证可退出
- 动画组件卸载时清理所有定时器（`useEffect` cleanup）

## Dependencies

- `motion/react` — 已安装，无需新增
- `lucide-react` — Skip 按钮图标（ArrowRight）
- 无外部 SVG 资源，全部用 inline SVG path

## File Changes

| File | Action |
|------|--------|
| `components/sky/home/intro-sequence.tsx` | New — 主动画组件 |
| `app/page.tsx` | Modify — 包裹 IntroSequence 控制显隐 |
