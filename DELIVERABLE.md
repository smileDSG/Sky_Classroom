# 智眸无界 多智能体课堂平台 — 可运行交付包说明（竞赛第 2 项）

> 本包包含：**项目完整源码 + 数据集 + 模型部署配置 + 一键运行配置**，可在常规环境下直接运行。
> 本项目为 **Next.js 16 + React 19 + TypeScript** 的 AI 多智能体互动课堂平台，核心是多智能体编排（LangGraph 导演图）+ 四段式幻灯片生成管线。

---

## 0. 评委最快体验（无需任何密钥 / 无需联网）

**这是最推荐的第一件事**，因为评委机器上通常没有模型 Key：

1. 按下面「方式一」启动（Docker）或「方式二」启动（本地）。
2. 浏览器打开 **http://localhost:3000/sky/software-cup**
3. 页面内置「软件杯零密钥演示」：直接调用预置的多智能体结果（含 **agentTrace 智能体轨迹**、生成资源、学习路径、质检报告），**完全不调用大模型**，即使没有任何 API Key 也能看到完整多智能体课堂效果。

> 为什么能保证「无 Key 也能用」：生成接口在缺少模型时会被 `getModel()` 抛出 *API key required*，随后 **优雅回退**到 `data/demo/software-cup/generated-resources.json` 的预置资源（`generationSource: 'demo'`），不会崩溃。

如需登录体验完整界面：演示账号 **`demo` / `SkyClassroom123!`**（已由 `ENABLE_DEMO_ACCOUNT=true` 自动开启）。

---

## 1. 环境要求

| 方式 | 依赖 |
| --- | --- |
| Docker（推荐） | Docker 20.10+ / Docker Compose v2（自带 LibreOffice、数据库无关） |
| 本地 | Node.js 20+、pnpm 9+（本包已含 `pnpm-lock.yaml` 可复现） |

> **网络说明（重要）**：解压后的目录顶层为 `sky_classroom-multiagent/`，请先 `cd sky_classroom-multiagent` 再操作。首次 `docker compose up --build` 或本地 `pnpm install` **需要可访问 npm 源**以拉取依赖（依赖不随包分发，以保证包体精简、且避免跨平台原生二进制不兼容）。依赖装好后后续启动无需联网。零密钥演示本身运行时不依赖任何外部网络。

> 本交付包**不依赖外部数据库**：未配置 MySQL/Supabase 时，服务自动回退到内存存储（仅告警，不崩溃），因此 `docker compose up` 开箱即跑。

---

## 2. 方式一：Docker 一键运行（推荐）

```bash
# 1) 进入解压后的目录
cd <解压目录>

# 2) 准备环境变量（本包已附赠一个无密钥的安全 .env.local，可直接用）
#    若需 AI「生成新课」，编辑 .env.local 填入任一模型 Key，或见第 5 节
#    （包内 .env.local 已设置 ENABLE_DEMO_ACCOUNT=true）

# 3) 构建并启动（首次会拉取基础镜像、安装依赖、构建，需几分钟）
docker compose up --build

# 4) 浏览器访问
#    - 零密钥演示：http://localhost:3000/sky/software-cup
#    - 完整应用：   http://localhost:3000  （演示账号 demo / SkyClassroom123!）
```

> 注意：演示数据已**打包进镜像的 `/app/data`**（软件杯演示依赖 `data/demo` 与 `data/course-knowledge`）。请勿把数据卷挂到 `/app/data`，否则会遮蔽镜像内数据导致演示失败；如需持久化用户数据请改用 MySQL/Supabase 或挂载到其它路径。

---

## 3. 方式二：本地 pnpm 运行

```bash
cd <解压目录>
pnpm install            # 依据 pnpm-lock.yaml 安装（已包含在包内）
cp .env.example .env.local   # 或直接使用包内附赠的 .env.local
pnpm dev                # 开发模式，默认 http://localhost:3000
# 生产模式：
#   pnpm build && pnpm start
```

---

## 4. 两种使用模式的区别

| 模式 | 是否需要 Key | 能看到什么 |
| --- | --- | --- |
| **零密钥演示**（默认） | 否 | `/sky/software-cup` 完整多智能体课堂（预置轨迹+资源+质检） |
| **AI 生成新课** | 是 | 在应用内输入主题，由多智能体实时生成新课（需配置模型 Key） |

---

## 5. 模型部署配置（如何开启 AI 生成）

两种方式二选一：

**A. 环境变量（.env.local）** — 填入任一提供商 Key 即可，例如：
```
DEEPSEEK_API_KEY=sk-xxxx
# 或 OPENAI_API_KEY=sk-xxxx / ANTHROPIC_API_KEY=...
DEFAULT_MODEL=deepseek:deepseek-chat
```
支持多 Key 轮询：`DEEPSEEK_API_KEY=sk-aaa,sk-bbb`。

**B. server-providers.yml** — 复制 `model-deploy/` 下示例并重命名：
```bash
cp model-deploy/server-providers.ollama.yml server-providers.yml   # 本地 Ollama 离线
# 或 cp model-deploy/server-providers.example.yml server-providers.yml  # 云端多提供商
```
并在 docker-compose.yml 中取消该行注释以挂载：`- ./server-providers.yml:/app/server-providers.yml:ro`

**完全离线方案**：本机安装 Ollama 并 `ollama pull llama3.3`，使用 `model-deploy/server-providers.ollama.yml`，无需任何云端 Key 即可让多智能体实时生成。

---

## 6. 多智能体核心架构

- **编排层** `lib/orchestration/`：LangGraph 状态机导演图，管理 AI 教师/同学发言、讨论、圆桌辩论等多智能体回合；含智能体注册表与角色模板。
- **幻灯片管线** `lib/slides/agent/pipeline.ts`：规划 → 章节 → 页面设计 → 质检 四段式，每段均有 Zod Schema 约束，3 次指数退避重试。
- **零密钥演示** `lib/software-cup/demo-service.ts`：`runSoftwareCupGeneration`，默认读预置资源，无模型时优雅回退。
- **动作引擎** `lib/action/`：28+ 动作类型（语音、白板绘制/文本/形状/图表、聚光灯、激光笔等）。

---

## 7. 数据集说明

`data/` 目录随包提供：
- `data/demo/software-cup/` — 软件杯演示输入与预置多智能体结果（评委零密钥体验的数据源）。
- `data/course-knowledge/` — 课程知识库（演示检索增强用的课程证据）。
- 其余：`data/raw`（原始素材）、`data/student-profiles`（学生画像）、`data/adaptive-learning`（自适应学习样本）等。

---

## 8. 已做的可运行性验证

- [x] 源码可成功完成 `next build`（生产构建 + standalone 输出）。
- [x] 零密钥路径代码确认：缺模型时接口回退预置资源，不崩溃。
- [x] 打包剔除 `node_modules/.next/.git`、重复副本、临时草稿、密钥文件、日志；中文文件名（如 `public/avatars/`）以 UTF-8 编码保留。
- [x] Docker 配置已修正：演示数据随镜像分发、移除会遮蔽 `/app/data` 的数据卷、默认开启演示账号。
- [x] 附带开箱即用的无密钥 `.env.local`。

> 备注：本机沙箱无法启动 Docker daemon，故生产镜像的实跑由评委环境完成；但构建流程与 Dockerfile 完全一致（同一 `next build` + standalone），且已在本地完成等价构建与零密钥接口验证。

---

## 9. 目录速览

```
app/                   Next.js App Router（页面 + API 路由，含 /sky/software-cup 演示页）
lib/                   核心业务（orchestration 多智能体 / slides 生成 / action / ai / export ...）
components/            React UI（shadcn/ui + Radix）
packages/              工作区包（pptxgenjs 定制 / mathml2omml）
configs/               常量（形状/字体/快捷键/主题）
data/                  数据集（随镜像分发，见第 7 节）
migrations/            SQL 迁移（SQLite 本地 / MySQL 生产）
Dockerfile            多阶段构建（含 LibreOffice，standalone 输出）
docker-compose.yml    一键运行（已默认开启演示账号、移除遮蔽数据卷）
.env.local            附赠：无密钥安全配置（ENABLE_DEMO_ACCOUNT=true）
.env.example          完整环境变量样例
model-deploy/         模型部署示例（Ollama 离线 / 云端多提供商）
server-providers.yml.example  提供商配置样例
DELIVERABLE.md        本说明
```
