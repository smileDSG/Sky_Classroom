# 学生端学习流程改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 将学生端首页与“今日计划”收敛为一条明确、可执行的学习主线，让学生知道当前最重要的任务、推荐原因、预计用时和完成后的下一步。

**架构：** 继续使用现有 `StudyLabViewModel` 作为学生端聚合数据源，不新增第二套学习计划状态。新增一个纯函数任务投影，统一产生首页主任务和今日计划页使用的标题、来源、推荐理由、预计时长与下一步链接；首页负责决策入口，今日计划页负责执行和更新任务状态。

**技术栈：** Next.js App Router、React 19、TypeScript、Tailwind CSS、Vitest、Testing Library、现有学习计划 API。

---

## 文件结构与职责

- 修改 `lib/sky/study-lab-data.ts`
  - 扩展学生端统一视图模型，提供今日任务的语义化投影。
  - 保持 API 快照与页面组件解耦。
- 修改 `tests/sky/study-lab-data.test.ts`
  - 覆盖计划任务优先级、计划完成、缓冲日、推荐回退和首次使用场景。
- 修改 `components/sky/study-lab/today-mission-panel.tsx`
  - 使用统一任务投影。
  - 展示推荐来源、推荐原因、预计用时和完成标准。
- 修改 `tests/sky/today-mission-panel.test.tsx`
  - 验证学生看到的主任务信息和唯一主操作。
- 修改 `app/sky/page.tsx`
  - 首页只保留“今天优先完成”的主任务和少量辅助入口。
  - 移除与今日任务重复的独立推荐内容，避免多个同等级开始入口。
- 修改 `components/sky/study-lab/study-lab-page.tsx`
  - 今日计划页改成任务执行页，强化完成度、状态分组和任务完成标准。
- 修改 `components/sky/learning/learning-plan-panel.tsx`
  - 复用统一展示规则，保留已有今日/本周/未来 28 天切换与状态更新能力。
- 新增或修改 `tests/sky/learning-plan-panel.test.tsx`
  - 覆盖任务状态、完成标准和完成后的反馈。
- 修改 `tests/sky/section-nav-routes.test.ts`
  - 只在路由标签或入口变更时更新；如果不需要变更则不触碰。

## 任务一：统一今日任务语义模型

**文件：**
- 修改：`lib/sky/study-lab-data.ts`
- 测试：`tests/sky/study-lab-data.test.ts`

- [ ] **步骤 1：先写失败测试，定义任务投影行为**

在 `tests/sky/study-lab-data.test.ts` 中增加对公开函数 `getStudyLabTodayMission` 的测试。测试使用已有 `makeSnapshots()`，要求：

```ts
it('exposes the scheduled task as the single primary mission with evidence', () => {
  const viewModel = buildStudyLabViewModel(makeSnapshots());
  const mission = getStudyLabTodayMission(viewModel);

  expect(mission).toMatchObject({
    title: '练一练：巩固反向传播',
    href: '/sky/cloud-mind/quiz?topic=nn',
    sourceLabel: '今日计划',
    durationLabel: '约 30 分钟',
    reason: expect.stringContaining('基础'),
    successCriteria: ['完成练习'],
  });
});
```

再增加三个边界行为测试：

```ts
it('uses plan completion as the primary mission state', () => {
  const viewModel = buildStudyLabViewModel(makeSnapshots());
  viewModel.learningPlan!.todayTask = null;
  viewModel.learningPlan!.todaySummary = {
    totalTasks: 2,
    completedTasks: 2,
    plannedMinutes: 40,
    completionRate: 100,
  };

  expect(getStudyLabTodayMission(viewModel)).toMatchObject({
    title: '今天的学习任务已完成',
    sourceLabel: '今日完成',
    href: '/sky/learning/today',
  });
});

it('explains a planned buffer day without falling back to a random recommendation', () => {
  const viewModel = buildStudyLabViewModel(makeSnapshots());
  viewModel.learningPlan!.todayTask = null;
  viewModel.learningPlan!.todaySummary = {
    totalTasks: 0,
    completedTasks: 0,
    plannedMinutes: 0,
    completionRate: 0,
  };

  expect(getStudyLabTodayMission(viewModel)).toMatchObject({
    title: '今天是计划缓冲日',
    sourceLabel: '计划安排',
    durationLabel: '无需额外学习',
  });
});

it('falls back to personalization, review, and starter practice in that order', () => {
  const snapshots = makeSnapshots({ learningPlan: { status: 'fulfilled', data: { plan: null, view: null } } });
  const viewModel = buildStudyLabViewModel(snapshots);

  expect(getStudyLabTodayMission(viewModel)).toMatchObject({
    title: '先练神经网络基础',
    sourceLabel: '为你推荐',
  });
});
```

- [ ] **步骤 2：运行测试确认测试因函数不存在而失败**

运行：

```bash
pnpm vitest run tests/sky/study-lab-data.test.ts
```

预期：失败，原因是 `getStudyLabTodayMission` 尚未导出；不得因为测试配置、导入路径或类型错误失败。

- [ ] **步骤 3：实现最小任务投影类型与函数**

在 `lib/sky/study-lab-data.ts` 中新增：

```ts
export interface StudyLabTodayMission {
  title: string;
  detail: string;
  href: string;
  sourceLabel: string;
  durationLabel: string;
  reason: string;
  successCriteria: string[];
  state: 'ready' | 'completed' | 'buffer-day' | 'starter';
}
```

新增 `getStudyLabTodayMission(viewModel)`，决策顺序固定为：

1. `learningPlan.todayTask` 存在时使用计划任务；
2. 今日计划存在且 `todaySummary.completionRate === 100` 时返回已完成；
3. 今日计划存在但没有任务时返回缓冲日；
4. 使用 `profile.recommendation`；
5. `workshop.dueReviewCount > 0` 时返回记忆复习；
6. 最后返回首次练习。

计划任务标题使用任务类型前缀：`diagnostic` 为“先测一测”、`learn` 为“先学懂”、`worked-example` 为“跟着例题学会”、`practice` 为“练一练”、`review` 为“复习一下”。计划任务理由基于 `task.reasonCodes` 映射为中文说明，优先使用已有 `reasonCodes`，没有时使用“这是学习路径中的下一步”。

- [ ] **步骤 4：运行数据层测试确认通过**

运行：

```bash
pnpm vitest run tests/sky/study-lab-data.test.ts
```

预期：该文件全部通过。

## 任务二：改造今日任务卡

**文件：**
- 修改：`components/sky/study-lab/today-mission-panel.tsx`
- 测试：`tests/sky/today-mission-panel.test.tsx`

- [ ] **步骤 1：先写失败测试，验证真实用户能理解任务**

在现有测试中增加以下断言：

```tsx
it('shows source, reason, success criteria, and one primary action', () => {
  render(
    <TodayMissionPanel viewModel={makeViewModel()} onRefresh={vi.fn()} refreshing={false} />,
  );

  expect(screen.getByText('今日计划')).toBeInTheDocument();
  expect(screen.getByText(/为什么现在做/)).toBeInTheDocument();
  expect(screen.getByText(/基础薄弱/)).toBeInTheDocument();
  expect(screen.getByText(/完成练习/)).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /开始今日任务/ })).toHaveLength(1);
});
```

- [ ] **步骤 2：运行测试确认新断言失败**

运行：

```bash
pnpm vitest run tests/sky/today-mission-panel.test.tsx
```

预期：新断言因现有组件没有“为什么现在做”和完成标准而失败。

- [ ] **步骤 3：使用统一投影替换组件内重复的 `buildMission`**

删除组件本地的任务优先级函数，改为导入 `getStudyLabTodayMission`。卡片结构固定为：

- 顶部显示 `sourceLabel` 和 `durationLabel`；
- 标题显示 `mission.title`；
- 正文显示 `mission.detail`；
- 增加“为什么现在做？”说明区显示 `mission.reason`；
- 当 `successCriteria` 非空时显示“完成标准”列表；
- 仅保留一个主链接按钮；
- 已完成状态按钮改为“查看今日安排”，缓冲日按钮改为“查看完整安排”。

刷新按钮继续保留，并使用现有错误提示区域。

- [ ] **步骤 4：运行组件测试确认通过**

运行：

```bash
pnpm vitest run tests/sky/today-mission-panel.test.tsx
```

预期：该文件全部通过。

## 任务三：首页收敛为唯一主线

**文件：**
- 修改：`app/sky/page.tsx`
- 测试：`tests/sky/star-tips-dashboard.test.tsx` 或新增 `tests/sky/student-dashboard-flow.test.tsx`

- [ ] **步骤 1：先写失败测试，锁定首页主操作**

新增页面测试或在现有首页测试中增加结构性断言：

```tsx
it('presents one primary next action and delegates the full plan to today plan', () => {
  render(<SkyDashboardPage />);

  expect(screen.getByRole('link', { name: /开始今日任务/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /查看完整今日计划/ })).toHaveAttribute(
    'href',
    '/sky/learning/today',
  );
});
```

若现有页面测试需要复杂认证和网络 fixture，则先测试新增的纯展示组件或使用项目已有 mock 约定，不新增重复的 API mock 工具。

- [ ] **步骤 2：运行测试确认失败或确认现有行为缺口**

运行：

```bash
pnpm vitest run tests/sky/star-tips-dashboard.test.tsx
```

如果测试无法挂载首页，记录实际失败原因并改为测试提取出的纯展示组件；不得把无法挂载当作通过。

- [ ] **步骤 3：调整首页展示层级**

在 `app/sky/page.tsx` 中：

- 将标题渐变改为已有的纯色语义标题，避免首页继续使用与“专业感”目标相冲突的装饰性文字；
- 保留 `TodayFocusPanel` 作为首页唯一主任务，但文案统一为“今天优先完成”；
- 主按钮统一为“开始今日任务”；
- 计划摘要按钮统一为“查看完整今日计划”，链接到 `/sky/learning/today`；
- 删除或降级会与主任务重复的单独推荐入口；
- 保留错题复习，但将其作为辅助入口，文案明确“完成主任务后再处理”；
- 空状态只保留一个“开始做题”主入口，并说明建立学习记录的结果；
- 不改 API 和学习算法，不在首页复制任务优先级逻辑。

- [ ] **步骤 4：运行首页相关测试**

运行：

```bash
pnpm vitest run tests/sky/star-tips-dashboard.test.tsx tests/sky/study-lab-data.test.ts
```

预期：全部通过。

## 任务四：今日计划页强化为执行清单

**文件：**
- 修改：`components/sky/study-lab/study-lab-page.tsx`
- 修改：`components/sky/learning/learning-plan-panel.tsx`
- 测试：新增或修改 `tests/sky/learning-plan-panel.test.tsx`

- [ ] **步骤 1：先写失败测试，锁定任务执行反馈**

测试今日计划页在有任务时显示：

```tsx
it('shows completion progress and the next concrete step for each task', () => {
  render(<LearningPlanPanel initialData={data} onPlanChanged={vi.fn()} />);

  expect(screen.getByText('完成情况')).toBeInTheDocument();
  expect(screen.getByText(/完成标准/)).toBeInTheDocument();
  expect(screen.getByText('完成练习')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /开始练习/ })).toBeInTheDocument();
});
```

另测完成任务后会显示现有成功反馈文案“做完了，接下来会按你的结果安排下一步”。

- [ ] **步骤 2：运行测试确认缺口**

运行：

```bash
pnpm vitest run tests/sky/learning-plan-panel.test.tsx
```

预期：新增的完成标准断言失败。

- [ ] **步骤 3：增加执行清单信息**

在非紧凑模式的任务项中显示：

- 状态标签：待完成、进行中、已完成、已跳过；
- 工具与动作：今天用什么工具、具体按钮文字；
- 预计时长；
- “为什么需要做？”；
- “完成标准”列表，来自 `task.successCriteria`；
- 主操作链接与状态更新按钮保持清晰分工。

首页紧凑模式只显示前三项和摘要；完整今日计划页显示全部任务，并继续保留今日、本周、未来 28 天切换。

在 `StudyLabPage` 的页头把“打开云端智囊”降为辅助链接，主内容优先展示今日完成度与任务清单。

- [ ] **步骤 4：运行组件测试确认通过**

运行：

```bash
pnpm vitest run tests/sky/learning-plan-panel.test.tsx tests/sky/today-mission-panel.test.tsx
```

预期：全部通过。

## 任务五：完整验证学生路径

**文件：** 无新增生产文件；必要时修改对应测试。

- [ ] **步骤 1：运行格式检查**

运行：

```bash
pnpm check
```

预期：Prettier 检查通过；如果已有无关格式问题，只记录文件，不批量格式化无关文件。

- [ ] **步骤 2：运行类型检查**

运行：

```bash
npx tsc --noEmit
```

预期：无 TypeScript 错误。

- [ ] **步骤 3：运行相关单元测试**

运行：

```bash
pnpm vitest run tests/sky/study-lab-data.test.ts tests/sky/today-mission-panel.test.tsx tests/sky/learning-plan-panel.test.tsx tests/sky/section-nav-routes.test.ts
```

预期：全部通过。

- [ ] **步骤 4：运行浏览器流程验证**

启动开发服务器后，使用系统 Chrome 验证：

1. 打开 `/sky`，确认首页只有一个“开始今日任务”主入口；
2. 点击“查看完整今日计划”，确认进入 `/sky/learning/today`；
3. 确认今日计划显示完成度、任务状态、预计时长、推荐原因和完成标准；
4. 点击任务主操作，确认进入任务对应页面；
5. 返回今日计划，确认页面没有重复的主入口或错乱状态；
6. 在无计划、缓冲日和加载失败状态下确认有明确下一步文案。

- [ ] **步骤 5：记录验证结果并结束本轮改造**

只报告实际通过的检查。若 ESLint 仍因项目已有 `react` 插件解析问题失败，单独注明该环境问题，不将其描述为本轮改造引入。
