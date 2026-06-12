# 复习计划功能优化方案

## 现状问题

复习计划目前是**纯展示**，没有闭环：

1. **遗忘曲线**：固定 SVG，不反映用户实际数据
2. **今日待复习列表**：只能看，不能操作
3. **没有复习提交接口**：只有 `GET /api/sky/review/due`，没有 POST
4. **错题本"已掌握"按钮**：直接 `reviewed=true`，跳过所有间隔，违背艾宾浩斯逻辑
5. **复习计划与错题本不联动**

## 已完成的优化

### 第一步：修复错题本"已掌握"按钮 ✅

**文件**：`lib/store/use-sky-classroom-store.ts`、`components/sky/learning/mistake-book.tsx`

改动：
- `markReviewed(id, correct)` 新增 `correct` 参数
- 答对：`reviewCount + 1`，只有 `reviewCount >= 6` 才设 `reviewed=true`
- 答错：重置 `reviewCount=0`，重新开始间隔
- 按钮文案改为"复习一次 N/6"，显示进度
- 已掌握的题目显示"已掌握"标签而非按钮

### 第二步：给复习计划列表加操作按钮 ✅

**文件**：`components/sky/learning/review-plan.tsx`

改动：
- 每条待复习题目新增"开始复习"按钮
- 点击后展开题目详情（题目、我的答案、正确答案）
- 两个操作按钮："答对了 ✓" / "还是错了 ✗"
- 答对走艾宾浩斯间隔，答错重置复习计数
- 复习后自动刷新数据

### 第三步：扩展复习 API ✅

**文件**：`app/api/sky/mistakes/route.ts`、`lib/storage/dao/mistakes.ts`

改动：
- 扩展 `PATCH /api/sky/mistakes` 接口，新增 `correct` 参数（默认 true）
- `correct=true`：调用 `recordReview()`，走艾宾浩斯间隔更新
- `correct=false`：调用新增的 `resetReview()`，重置 reviewCount/masteryLevel/nextReview
- 无需新建单独的 `/api/sky/review/complete` 端点

## 待完成

### 第四步：遗忘曲线动态化（可选，优先级低）

用用户实际的复习数据画曲线，而不是固定公式。前三步做完再考虑。

## 方案核心

前三步形成闭环——错题进入复习计划 → 到期提醒 → 用户复习 → 间隔更新 → 循环。第四步是视觉优化，不影响功能。
