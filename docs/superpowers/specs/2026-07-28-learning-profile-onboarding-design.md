# Learning Profile Onboarding Design

**Date:** 2026-07-28
**Status:** Approved direction

## Goal

为新注册用户和尚未建立画像的现有普通用户提供一个可跳过、约一分钟完成的首次学习画像流程。流程采集用户明确表达的偏好和学科级自评，复用现有学生画像与诊断能力，不把自评结果伪装成系统测得的掌握度。

## Product Decisions

- 覆盖新注册用户，以及没有完成或跳过当前版本画像的现有普通用户。
- 管理员、访客和认证页面不触发画像流程。
- 首次进入展示独立 onboarding 页面，用户可以完成或选择“暂时跳过”。
- 跳过后不再自动弹出或重定向，只在首页和设置页保留“完善学习画像”入口。
- 首版面向初中和高中。
- 问卷控制在三个步骤、约一分钟内完成。
- 薄弱项只采集到学科级；具体薄弱知识点由诊断题、错题和测验行为识别。
- 学习偏好使用具体教学行为，不使用“视觉型学习者”等固定人格标签。
- 学习目标采用固定选项加可选补充说明。
- 诊断小测是完成后的推荐动作，不阻塞进入系统。

## Existing Capabilities To Reuse

- `users` 已保存教育阶段、年级、兴趣学科、学习风格和回答偏好。
- `/api/user/personalization` 已提供偏好读写能力。
- `buildStudentProfile()` 已从错题和测验聚合真实掌握度及薄弱知识点。
- 教学诊断 API 已能生成题目、记录答案并刷新学生画像。
- 云端智囊和首页已有“入门诊断”推荐位置。

## Data Semantics

系统必须区分三类信息：

1. **Declared preferences**：用户主动选择的教育阶段、年级、关注学科和教学方式。
2. **Self-reported weakness**：用户自认为薄弱的学科，只是冷启动线索。
3. **Observed profile**：系统根据测验、错题和学习行为计算的掌握度与薄弱知识点。

自评薄弱学科不得写入 `StudentProfile.masteryBySubject`、`masteryByKnowledge` 或 `weakPoints`。一旦存在真实学习数据，推荐排序以 observed profile 为准；自评信息仍可在设置页修改，但不覆盖实测结果。

## Considered Approaches

### 1. Versioned JSON block on the user record (selected)

在现有 `UserEntry` 上增加一个可空的 `learningOnboarding` JSON 字段。教育阶段、年级和兴趣学科继续写入现有字段；新增的状态、弱势学科、目标和具体教学偏好放入版本化 JSON。

优点：一次用户更新即可原子保存；认证接口可直接返回状态；只新增一个数据库字段；不需要新的 DAO 或跨表读取。

### 2. Many normalized user columns

为状态、版本、时间、目标、弱势学科和教学偏好分别增加列。

未选择原因：字段和存储映射改动过多，后续问卷版本变化会继续扩张用户表。

### 3. Separate onboarding storage table

使用通用 `storage_entries` 保存独立 onboarding 记录。

未选择原因：登录后需要额外查询，完成问卷时还要同时更新用户偏好和 onboarding 记录，增加一致性与失败恢复复杂度。

## Data Contract

新增可判别联合类型：

```ts
type LearningOnboardingProfile =
  | {
      version: 1;
      status: 'completed';
      weakSubjects: Subject[];
      learningGoal: 'improve-grades' | 'exam-prep' | 'build-foundations' | 'explore-interest';
      goalDetail?: string;
      teachingPreference:
        | 'example-first'
        | 'visual-explanation'
        | 'step-by-step'
        | 'practice-first'
        | 'balanced';
      completedAt: number;
    }
  | {
      version: 1;
      status: 'skipped';
      skippedAt: number;
    };
```

`learningOnboarding === null` 表示当前版本尚未处理。未来只有在产品明确要求重新收集时才提升版本；首版不因版本变化自动打断用户。

完成请求同时包含：

- `educationLevel`: `middle | high`
- `grade`: 初一至初三，或高一至高三
- `favoriteSubjects`: 学科 ID 数组
- `weakSubjects`: 学科 ID 数组
- `learningGoal`
- `goalDetail`: 可选，最多 120 字
- `teachingPreference`

## User Flow

### Entry Gate

`/api/auth/me` 返回精简的 `onboardingStatus`。全局 `OnboardingGate` 仅在认证状态稳定后判断：

- 未登录、访客、管理员：不处理。
- 位于 `/auth/*` 或 `/sky/onboarding`：不处理。
- 普通用户状态为空：跳转至 `/sky/onboarding?redirect=<原内部路径>`。
- 状态为 `completed` 或 `skipped`：正常访问。

`redirect` 仅允许以 `/` 开头的站内路径，禁止协议和双斜线，避免开放重定向。

### Three-Step Questionnaire

1. **学习阶段**：初中/高中；选择后展示对应年级。
2. **学科情况**：选择关注学科和自评薄弱学科。两者允许重叠，因为“重视”与“薄弱”并不互斥。
3. **目标与讲法**：选择主要目标、可选补充说明、一个主要教学偏好。

每一步只在前端保存临时状态。最后提交一次，避免半成品画像影响推荐。刷新页面后允许重新开始；一分钟问卷不做草稿持久化。

### Completion

完成后显示简短摘要，并提供两个动作：

- “做一次入门诊断”：跳到现有智能出题页，并预填第一个自评薄弱学科。
- “先逛逛”：返回安全的原始目标路径，没有目标时进入 `/sky`。

### Skip

跳过操作写入 `status: 'skipped'`，随后返回原始目标路径。首页空状态和账户个性化设置页展示“完善学习画像”入口；不再自动重定向。

## API Design

新增 `/api/user/learning-onboarding`：

- `GET`：返回当前状态、已保存画像以及现有教育阶段/年级/兴趣学科，用于重新编辑。
- `PUT`：校验并一次性更新现有用户偏好字段与 `learningOnboarding`。
- `POST /skip`：只记录当前版本的 skipped 状态。

所有端点使用 `requireAuth()`，服务端从令牌确定用户 ID，不接受客户端传入 userId。

提交完成后客户端调用现有 `auth.refresh()`，使 gate 使用最新状态。

## Personalization Consumption

- 扩展集中式个性化解析，让 `teachingPreference` 转换为具体提示：例题优先、图示优先、分步推导、先练后讲或均衡。
- 不逐个修改生成路由；只改现有集中式个性化 helper 的输入与输出。
- 没有真实学习数据时，首页/云端智囊优先推荐对第一个自评薄弱学科做诊断。
- 已有真实学习数据时，继续使用 `StudentProfile` 的薄弱点和掌握度，自评学科不参与分数计算。

## Error Handling

- 加载失败：显示可重试状态，并允许返回登录页；不能把失败当作已跳过。
- 保存失败：保留当前表单状态，显示服务端错误，不自动进入首页。
- 重复提交：`PUT` 使用覆盖语义，相同请求可安全重试。
- skip 失败：留在当前页面并允许重试。
- 旧记录或非法 JSON：服务端按未完成处理，记录日志但不让页面崩溃。

## Accessibility And Responsive Behavior

- 使用语义化 `fieldset`、`legend`、原生单选/复选行为和可见焦点。
- 所有选择项可用键盘操作，并通过文本而非只靠颜色表达选中状态。
- 390px 宽度下保持单列，底部操作区不遮挡内容。
- 三步容器尺寸稳定，切换选项不导致整体布局跳动。

## Testing Scope

- Schema：合法完成、跳过、非法年级、非法学科、超长补充说明。
- DAO/provider mapping：JSON 字段在 MySQL、Supabase/通用存储映射中正确往返。
- API：未认证、读取、完成、跳过、重复提交和非法请求。
- Gate：新用户重定向、completed/skipped 放行、管理员/访客/排除路径放行、redirect 安全。
- UI：三个步骤、验证、返回、完成、跳过、失败重试和移动端布局。
- Personalization：具体教学偏好映射，以及无行为数据时使用自评弱势学科推荐诊断。
- Regression：现有学生画像不会因自评学科而产生虚假的掌握度或薄弱知识点。

## Non-Goals

- 不重写认证、用户设置、学生画像或学习路径架构。
- 不新建第二套掌握度模型。
- 不在首版做动态问卷、草稿自动保存、心理测评或学习人格分类。
- 不强制完成诊断题。
- 不为本功能做无关 UI 重构或存储层抽象。
- 不安排多轮或多代理代码审查；实施阶段只做聚焦自审和必要验证。

## Acceptance Criteria

1. 新注册用户和未处理画像的现有普通用户只被引导一次。
2. 用户可以在一分钟左右完成三个步骤，也可以明确跳过。
3. 跳过后不再自动打断，首页和设置页仍可重新进入。
4. 完成后教育阶段、年级、关注学科和版本化画像持久化，刷新后保持。
5. 自评薄弱学科不会写入系统测得的掌握度或薄弱知识点。
6. 无行为数据时可按自评弱势学科推荐诊断；有行为数据时实测画像优先。
7. 诊断始终可选，完成或跳过后都能进入原目标页面。
8. 所有新增 API 均使用当前认证用户并拒绝非法输入。
9. 桌面和 390px 移动宽度下无重叠、溢出或不可操作控件。

