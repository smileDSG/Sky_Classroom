# OpenMAIC — 开放多智能体互动课堂

> 一键生成沉浸式多智能体互动课堂，由 AI 教师和 AI 同学实时授课、讨论、互动。

<p align="center">
  <img src="assets/banner.png" alt="OpenMAIC Banner" width="680"/>
</p>

<p align="center">
  <a href="https://jcst.ict.ac.cn/en/article/doi/10.1007/s11390-025-6000-0"><img src="https://img.shields.io/badge/Paper-JCST'26-blue?style=flat-square" alt="Paper"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License: AGPL-3.0"/></a>
  <a href="https://open.maic.chat/"><img src="https://img.shields.io/badge/Demo-Live-brightgreen?style=flat-square" alt="Live Demo"/></a>
  <br/>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/LangGraph-1.1-purple?style=flat-square" alt="LangGraph"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
</p>

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [技术架构](#技术架构)
- [环境要求](#环境要求)
  - [运行时环境](#1-运行时环境)
  - [系统级依赖](#2-系统级依赖)
  - [各平台安装指南](#3-各平台安装指南)
- [快速开始](#快速开始)
  - [克隆与安装](#1-克隆与安装)
  - [环境配置](#2-环境配置)
  - [启动开发服务器](#3-启动开发服务器)
  - [生产环境构建](#4-生产环境构建)
- [环境变量详解](#环境变量详解)
  - [LLM 服务商配置](#llm-服务商配置)
  - [TTS 语音合成配置](#tts-语音合成配置)
  - [ASR 语音识别配置](#asr-语音识别配置)
  - [图像生成配置](#图像生成配置)
  - [视频生成配置](#视频生成配置)
  - [PDF 文档解析配置](#pdf-文档解析配置)
  - [网络搜索配置](#网络搜索配置)
  - [通用配置](#通用配置)
- [部署方式](#部署方式)
  - [Vercel 部署](#vercel-部署)
  - [Docker 部署](#docker-部署)
  - [手动部署](#手动部署)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [测试](#测试)
- [常见问题](#常见问题)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

---

## 项目简介

**OpenMAIC**（Open Multi-Agent Interactive Classroom）是清华大学 THU-MAIC 团队开发的开源 AI 互动课堂平台。它能够将任何主题或文档转化为丰富的互动学习体验：

- **一键生成课堂** — 描述一个主题或附上学习材料，AI 几分钟内构建完整课堂
- **多智能体课堂** — AI 老师和智能体同学实时授课、讨论、互动
- **丰富的场景类型** — 幻灯片、测验、HTML 交互式模拟、项目制学习（PBL）
- **白板 & 语音** — 智能体实时绘制图表、书写公式、语音讲解
- **深度交互模式** — 3D 可视化、模拟实验、游戏、思维导图、在线编程
- **灵活导出** — 下载可编辑的 `.pptx` 幻灯片或交互式 `.html` 网页

---

## 核心特性

### 课堂组件

| 组件 | 说明 |
|------|------|
| **幻灯片 (Slides)** | AI 老师配合聚光灯和激光笔动作进行语音讲解 |
| **测验 (Quiz)** | 交互式测验（单选/多选/简答），AI 实时判分和反馈 |
| **交互式模拟 (Interactive)** | 基于 HTML 的交互实验，可视化动手学习 |
| **项目制学习 (PBL)** | 选择角色，与 AI 智能体协作完成结构化项目 |

### 深度交互模式

| 类型 | 说明 |
|------|------|
| **3D 可视化** | 三维可视化呈现，让抽象结构更直观 |
| **模拟实验** | 流程模拟和实验环境，观察动态变化和结果 |
| **游戏** | 知识小游戏，通过交互挑战加深理解和记忆 |
| **思维导图** | 结构化知识组织，帮助学习者建立整体概念框架 |
| **在线编程** | 浏览器内编码和即时运行，边写边学边迭代 |

### 多智能体互动

- **课堂讨论** — 智能体主动发起讨论话题，你可以随时加入或被点名互动
- **圆桌辩论** — 多个不同人设的智能体围绕话题展开讨论，配合白板讲解
- **自由问答** — 随时提问，AI 老师通过幻灯片、图表或白板进行解答
- **白板** — AI 智能体在共享白板上实时绘图——逐步推导方程、绘制流程图、直观讲解概念

### 支持的 AI 服务商

| 类别 | 服务商 |
|------|--------|
| **LLM** | OpenAI, Anthropic, Google Gemini, DeepSeek, Qwen, Kimi, MiniMax, GLM, Grok, OpenRouter, 腾讯混元, 小米 MiMo, 豆包, SiliconFlow, Ollama, Lemonade |
| **TTS** | OpenAI, Azure, MiniMax, ElevenLabs, GLM, Qwen, VoxCPM2 (自托管), Lemonade |
| **ASR** | OpenAI, Qwen, Lemonade |
| **图像** | OpenAI (DALL-E/GPT-Image), Seedream, Qwen, Nano Banana, MiniMax, Grok, Lemonade |
| **视频** | Seedance, Kling, Veo, Sora, MiniMax, Grok, HappyHorse |
| **搜索** | Tavily, Bocha, Brave, Bing, Baidu |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Next.js App Router)               │
│  React 19 + TypeScript + Tailwind CSS 4 + Zustand           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Slides   │ │ Quiz     │ │Interactive│ │ PBL      │       │
│  │ Renderer │ │ Renderer │ │ Renderer  │ │ Renderer │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Canvas Editor (Prosemirror) + Whiteboard (SVG)   │       │
│  └──────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                      后端 (Next.js API Routes)               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Generation   │ │ Orchestration│ │   Playback   │        │
│  │  Pipeline     │ │ (LangGraph)  │ │   Engine     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Action Engine│ │  AI Provider │ │   Media      │        │
│  │ (28+ types)  │ │  Abstraction │ │   Providers  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                      外部服务 (可选)                          │
│  LLM APIs · TTS/ASR APIs · Image/Video APIs · Search APIs  │
│  Ollama · Lemonade · VoxCPM2 · MinerU · LibreOffice        │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| **生成流水线** | `lib/generation/` | 两阶段：大纲生成 → 场景内容生成 |
| **多智能体编排** | `lib/orchestration/` | LangGraph 状态机，管理智能体轮次和讨论 |
| **回放引擎** | `lib/playback/` | 状态机驱动课堂回放和实时互动 |
| **动作引擎** | `lib/action/` | 执行 28+ 种动作类型 |
| **AI 抽象层** | `lib/ai/` | 统一 LLM 服务商接口 |
| **媒体服务** | `lib/media/` | 图像和视频生成 |
| **音频服务** | `lib/audio/` | TTS 和 ASR |
| **导出模块** | `lib/export/` | PPTX 和 HTML 导出 |

---

## 环境要求

### 1. 运行时环境

| 依赖 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| **Node.js** | >= 20.9.0 | 22.x LTS | JavaScript 运行时 |
| **pnpm** | >= 10.0.0 | 10.28.0 | 包管理器（项目锁定版本） |

> 项目根目录 `.nvmrc` 指定 `22`，推荐使用 [nvm](https://github.com/nvm-sh/nvm) / [fnm](https://github.com/Schniz/fnm) / [volta](https://volta.sh/) 管理 Node.js 版本。

### 2. 系统级依赖

#### 构建时依赖

native modules (`@napi-rs/canvas`, `better-sqlite3`) 需要 C++ 编译工具链：

| 平台 | 安装命令 |
|------|---------|
| **Debian/Ubuntu** | `apt-get install -y python3 build-essential g++ libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev` |
| **Alpine** | `apk add --no-cache libc6-compat python3 build-base g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev` |
| **macOS** | `brew install python3 pkg-config cairo pango jpeg giflib librsvg` |
| **Windows** | 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/)（C++ 桌面开发工作负载） |

#### 运行时依赖（可选）

- **LibreOffice** — PPTX 转图片导出需要
  - Debian/Ubuntu: `apt-get install -y libreoffice`
  - macOS: `brew install --cask libreoffice`
  - Windows: [下载安装](https://www.libreoffice.org/)

### 3. 各平台安装指南

#### Windows

```powershell
# 1. 安装 Node.js (推荐 v22 LTS)
#    下载: https://nodejs.org/zh-cn/
#    或使用 winget:
winget install OpenJS.NodeJS.LTS

# 2. 启用 corepack 并安装 pnpm
corepack enable
corepack prepare pnpm@10.28.0 --activate

# 3. (可选) 安装 Git
winget install Git.Git

# 4. (可选) 安装 Visual Studio Build Tools
#    如遇 native module 编译问题:
winget install Microsoft.VisualStudio.2022.BuildTools
#    安装时选择 "C++ 桌面开发" 工作负载
```

#### macOS

```bash
# 1. 安装 Homebrew (如未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装 Node.js
brew install node@22

# 3. 启用 corepack 并安装 pnpm
corepack enable
corepack prepare pnpm@10.28.0 --activate

# 4. 安装构建依赖 (native modules)
brew install python3 pkg-config cairo pango jpeg giflib librsvg

# 5. (可选) 安装 LibreOffice
brew install --cask libreoffice
```

#### Linux (Ubuntu/Debian)

```bash
# 1. 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 启用 corepack 并安装 pnpm
corepack enable
corepack prepare pnpm@10.28.0 --activate

# 3. 安装构建依赖
sudo apt-get install -y python3 build-essential g++ \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# 4. (可选) 安装 LibreOffice
sudo apt-get install -y libreoffice
```

---

## 快速开始

### 1. 克隆与安装

```bash
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
pnpm install
```

> 首次安装时 `postinstall` 脚本会自动构建工作区子包 (`mathml2omml`, `pptxgenjs`)。

### 2. 环境配置

```bash
cp .env.example .env.local
```

编辑 `.env.local`，**至少配置一个 LLM 服务商的 API Key**：

```env
# 最简配置 — 使用 OpenAI
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=openai:gpt-5.5
```

```env
# 或使用 Google Gemini (推荐，效果与速度最佳平衡)
GOOGLE_API_KEY=...
DEFAULT_MODEL=google:gemini-3-flash-preview
```

```env
# 或使用国内服务商 MiniMax
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimaxi.com/anthropic/v1
DEFAULT_MODEL=minimax:MiniMax-M2.7-highspeed
```

```env
# 或使用智谱 GLM
GLM_API_KEY=...
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
DEFAULT_MODEL=glm:glm-5.1
```

```env
# 或使用本地 Ollama (无需 API Key)
OLLAMA_BASE_URL=http://localhost:11434/v1
DEFAULT_MODEL=ollama:llama3.3
```

### 3. 启动开发服务器

```bash
pnpm dev
```

打开浏览器访问 **http://localhost:3000**，开始学习！

### 4. 生产环境构建

```bash
pnpm build
pnpm start
```

---

## 环境变量详解

所有环境变量均为**可选**，配置在 `.env.local` 文件中。也可通过 `server-providers.yml` 文件配置服务商。

### LLM 服务商配置

每个服务商遵循统一格式：`{PROVIDER}_API_KEY`、`{PROVIDER}_BASE_URL`（可选）、`{PROVIDER}_MODELS`（可选，逗号分隔）。

```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=                          # 可选，自定义端点
OPENAI_MODELS=                            # 可选，如 gpt-5.5,gpt-4o

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=
ANTHROPIC_MODELS=

# Google (Gemini)
GOOGLE_API_KEY=...
GOOGLE_BASE_URL=
GOOGLE_MODELS=

# DeepSeek
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=
DEEPSEEK_MODELS=                          # 如 deepseek-v4-pro,deepseek-v4-flash

# 通义千问 (Qwen)
QWEN_API_KEY=...
QWEN_BASE_URL=
QWEN_MODELS=

# Kimi (Moonshot)
KIMI_API_KEY=...
KIMI_BASE_URL=
KIMI_MODELS=

# MiniMax
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimaxi.com/anthropic/v1
MINIMAX_MODELS=                           # 如 MiniMax-M2.7-highspeed,MiniMax-M2.7

# 智谱 GLM
GLM_API_KEY=...
GLM_BASE_URL=                             # 国内: https://open.bigmodel.cn/api/paas/v4
                                          # 国际: https://api.z.ai/api/paas/v4
GLM_MODELS=

# Grok (xAI)
GROK_API_KEY=xai-...
GROK_BASE_URL=
GROK_MODELS=

# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODELS=                        # 如 deepseek/deepseek-v4-pro

# 腾讯混元 / TokenHub
TENCENT_API_KEY=sk-...
TENCENT_BASE_URL=https://tokenhub.tencentmaas.com/v1
TENCENT_MODELS=                           # 如 hy3-preview,hunyuan-2.0-thinking-20251109

# 小米 MiMo
XIAOMI_API_KEY=...
XIAOMI_BASE_URL=https://api.xiaomimimo.com/v1
XIAOMI_MODELS=                            # 如 mimo-v2.5-pro,mimo-v2.5

# 豆包 (字节跳动)
DOUBAO_API_KEY=...
DOUBAO_BASE_URL=
DOUBAO_MODELS=

# SiliconFlow
SILICONFLOW_API_KEY=...
SILICONFLOW_BASE_URL=
SILICONFLOW_MODELS=

# Ollama (本地，无需 API Key)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODELS=llama3.3,llama3.2,qwen2.5,mistral,gemma3

# Lemonade (本地，无需 API Key)
LEMONADE_BASE_URL=http://localhost:13305/v1
LEMONADE_MODELS=Qwen3-0.6B-GGUF,Llama-3.2-1B-Instruct-Hybrid
```

### TTS 语音合成配置

```env
TTS_OPENAI_API_KEY=...
TTS_OPENAI_BASE_URL=

TTS_AZURE_API_KEY=...
TTS_AZURE_BASE_URL=

TTS_GLM_API_KEY=...
TTS_GLM_BASE_URL=

TTS_QWEN_API_KEY=...
TTS_QWEN_BASE_URL=

TTS_MINIMAX_API_KEY=...
TTS_MINIMAX_BASE_URL=https://api.minimaxi.com

TTS_ELEVENLABS_API_KEY=...
TTS_ELEVENLABS_BASE_URL=

# VoxCPM2 (自托管，无需 API Key)
TTS_VOXCPM_BASE_URL=http://localhost:8000/v1

# Lemonade TTS (本地)
TTS_LEMONADE_BASE_URL=http://localhost:13305/v1
```

### ASR 语音识别配置

```env
ASR_OPENAI_API_KEY=...
ASR_OPENAI_BASE_URL=

ASR_QWEN_API_KEY=...
ASR_QWEN_BASE_URL=

# Lemonade ASR (本地，仅支持 WAV)
ASR_LEMONADE_BASE_URL=http://localhost:13305/v1
```

### 图像生成配置

```env
IMAGE_OPENAI_API_KEY=...
IMAGE_OPENAI_BASE_URL=https://api.openai.com/v1

IMAGE_SEEDREAM_API_KEY=...
IMAGE_SEEDREAM_BASE_URL=

IMAGE_QWEN_IMAGE_API_KEY=...
IMAGE_QWEN_IMAGE_BASE_URL=

IMAGE_NANO_BANANA_API_KEY=...
IMAGE_NANO_BANANA_BASE_URL=

IMAGE_MINIMAX_API_KEY=...
IMAGE_MINIMAX_BASE_URL=https://api.minimaxi.com

IMAGE_GROK_API_KEY=...
IMAGE_GROK_BASE_URL=

# Lemonade 图像生成 (本地)
IMAGE_LEMONADE_BASE_URL=http://localhost:13305/v1
```

### 视频生成配置

```env
VIDEO_SEEDANCE_API_KEY=...
VIDEO_SEEDANCE_BASE_URL=

VIDEO_KLING_API_KEY=...
VIDEO_KLING_BASE_URL=

VIDEO_VEO_API_KEY=...
VIDEO_VEO_BASE_URL=

VIDEO_SORA_API_KEY=...
VIDEO_SORA_BASE_URL=

VIDEO_MINIMAX_API_KEY=...
VIDEO_MINIMAX_BASE_URL=https://api.minimaxi.com

VIDEO_GROK_API_KEY=...
VIDEO_GROK_BASE_URL=

VIDEO_HAPPYHORSE_API_KEY=...
VIDEO_HAPPYHORSE_BASE_URL=https://dashscope.aliyuncs.com
```

### PDF 文档解析配置

```env
PDF_UNPDF_API_KEY=...
PDF_UNPDF_BASE_URL=

# MinerU (增强表格/公式/OCR 解析)
PDF_MINERU_API_KEY=...
PDF_MINERU_BASE_URL=
```

### 网络搜索配置

```env
TAVILY_API_KEY=...
BOCHA_API_KEY=...
BOCHA_BASE_URL=https://api.bocha.cn
BRAVE_API_KEY=...
BING_API_KEY=...
BAIDU_API_KEY=...
BAIDU_BASE_URL=https://qianfan.baidubce.com
```

### 通用配置

```env
# 默认模型 (格式: provider:model-name)
DEFAULT_MODEL=google:gemini-3-flash-preview

# 站点访问密码 (可选，共享部署时使用)
ACCESS_CODE=your-secret-code

# 允许本地网络 (自托管 Ollama 等场景)
ALLOW_LOCAL_NETWORKS=true

# 日志级别
LOG_LEVEL=info
LOG_FORMAT=pretty

# 禁用 LLM 思考模式
LLM_THINKING_DISABLED=false

# HTTP 代理 (可选)
# HTTP_PROXY=http://proxy:8080
# HTTPS_PROXY=http://proxy:8080
```

---

## 部署方式

### Vercel 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTHU-MAIC%2FOpenMAIC&envDescription=Configure%20at%20least%20one%20LLM%20provider%20API%20key%20(e.g.%20OPENAI_API_KEY%2C%20ANTHROPIC_API_KEY).%20All%20providers%20are%20optional.&envLink=https%3A%2F%2Fgithub.com%2FTHU-MAIC%2FOpenMAIC%2Fblob%2Fmain%2F.env.example&project-name=openmaic&framework=nextjs)

手动步骤：
1. Fork 本仓库
2. 导入到 [Vercel](https://vercel.com/new)
3. 配置环境变量（至少一个 LLM API Key）
4. 部署

### Docker 部署

```bash
# 1. 复制并编辑环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 API Key

# 2. 构建并启动
docker compose up --build
```

Docker Compose 配置说明：
- 服务暴露端口 `3000`
- 数据持久化到 `openmaic-data` 卷
- LibreOffice 已内置在镜像中（用于 PPTX→PNG）
- 可选挂载 `server-providers.yml` 进行服务商配置

开发模式 Docker：

```bash
docker build -f docker/Dockerfile.dev -t openmaic-dev .
docker run -p 3000:3000 -v $(pwd):/app openmaic-dev
```

### 手动部署

```bash
# 1. 克隆并安装
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local

# 3. 构建
pnpm build

# 4. 启动
pnpm start
```

---

## 项目结构

```
OpenMAIC/
├── app/                          # Next.js App Router
│   ├── api/                      #   服务端 API 路由 (~18 个端点)
│   │   ├── generate/             #     场景生成流水线
│   │   ├── generate-classroom/   #     异步课堂生成
│   │   ├── chat/                 #     多智能体讨论 (SSE)
│   │   ├── pbl/                  #     项目制学习
│   │   ├── quiz-grade/           #     测验判分
│   │   ├── parse-pdf/            #     PDF 解析
│   │   ├── web-search/           #     网络搜索
│   │   ├── transcription/        #     语音转文字
│   │   └── ...                   #     其他 API
│   ├── classroom/[id]/           #   课堂回放页面
│   └── page.tsx                  #   首页
│
├── lib/                          # 核心业务逻辑
│   ├── generation/               #   两阶段课堂生成流水线
│   ├── orchestration/            #   LangGraph 多智能体编排
│   ├── playback/                 #   回放状态机
│   ├── action/                   #   动作执行引擎 (28+ 类型)
│   ├── ai/                       #   LLM 服务商抽象层
│   ├── api/                      #   Stage API 门面
│   ├── store/                    #   Zustand 状态管理
│   ├── types/                    #   TypeScript 类型定义
│   ├── audio/                    #   TTS & ASR 服务商
│   ├── media/                    #   图像 & 视频生成
│   ├── export/                   #   PPTX & HTML 导出
│   ├── hooks/                    #   React Hooks (55+)
│   ├── prompts/                  #   Prompt 模板
│   └── pdf/                      #   PDF 处理
│
├── components/                   # React UI 组件
│   ├── slide-renderer/           #   幻灯片编辑器和渲染器
│   ├── scene-renderers/          #   场景渲染器
│   ├── generation/               #   课堂生成 UI
│   ├── chat/                     #   聊天区域
│   ├── settings/                 #   设置面板
│   ├── whiteboard/               #   白板绘图
│   ├── agent/                    #   智能体组件
│   ├── ai-elements/              #   AI 交互元素
│   └── ui/                       #   基础 UI (shadcn/ui)
│
├── packages/                     # 工作区子包
│   ├── mathml2omml/              #   MathML → Office Math
│   └── pptxgenjs/                #   定制化 PPTX 生成
│
├── skills/                       # OpenClaw 集成
│   └── openmaic/                 #   OpenMAIC Skill
│
├── configs/                      # 共享常量
├── public/                       # 静态资源
├── tests/                        # 测试文件
├── eval/                         # 评测脚本
├── scripts/                      # 工具脚本
│
├── .env.example                  # 环境变量模板
├── .nvmrc                        # Node.js 版本
├── package.json                  # 项目配置
├── pnpm-workspace.yaml           # pnpm 工作区配置
├── tsconfig.json                 # TypeScript 配置
├── vitest.config.ts              # 单元测试配置
├── playwright.config.ts          # E2E 测试配置
├── Dockerfile                    # 生产 Docker 镜像
├── docker-compose.yml            # Docker Compose 配置
└── docker/                       # 额外 Docker 配置
```

---

## 开发指南

### 开发命令

```bash
# 开发服务器 (Turbopack HMR)
pnpm dev

# 生产构建
pnpm build

# 启动生产服务
pnpm start

# 代码格式化
pnpm format

# ESLint 检查
pnpm lint
pnpm lint --fix                   # 自动修复

# TypeScript 类型检查
npx tsc --noEmit
```

### 提交规范

项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

类型：`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `style`

示例：
```
feat(tts): add Azure TTS provider
fix(whiteboard): prevent canvas from resetting on window resize
docs: add CONTRIBUTING.md
```

### 分支命名

- `feat/` — 新功能
- `fix/` — Bug 修复
- `docs/` — 文档变更

---

## 测试

### 单元测试

```bash
# 运行所有单元测试
pnpm test

# 运行测试 UI
pnpm test -- --ui
```

单元测试使用 [Vitest](https://vitest.dev/)，测试文件位于 `tests/` 目录。

### E2E 测试

```bash
# 安装 Playwright 浏览器 (首次)
pnpm exec playwright install chromium --with-deps

# 运行 E2E 测试
pnpm test:e2e

# 运行 E2E 测试 UI
pnpm test:e2e:ui
```

E2E 测试使用 [Playwright](https://playwright.dev/)。

### PR 前检查清单

提交 PR 前，请确保：

```bash
pnpm format                       # 1. 格式化代码
pnpm lint --fix                   # 2. ESLint 检查 + 自动修复
npx tsc --noEmit                  # 3. TypeScript 类型检查
pnpm test                         # 4. 单元测试通过
```

---

## 常见问题

### Q: `pnpm install` 时报 native module 编译错误？

A: 需要安装 C++ 编译工具链。参见 [系统级依赖](#2-系统级依赖)。

### Q: 如何使用本地 Ollama 模型？

A: 启动 Ollama 后，在 `.env.local` 中配置：

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
ALLOW_LOCAL_NETWORKS=true
DEFAULT_MODEL=ollama:llama3.3
```

### Q: 如何配置多个 LLM 服务商？

A: 在 `.env.local` 中配置多个服务商的 Key 即可。通过 `DEFAULT_MODEL` 设置默认模型，格式为 `provider:model-name`。用户可在界面中切换模型。

### Q: Docker 部署时 PPTX 导出失败？

A: Docker 镜像已内置 LibreOffice。如仍有问题，检查 `LO_SOFFICE_PATH` 环境变量是否指向正确的 `soffice` 路径。

### Q: 如何自定义 TTS 音色？

A: 在设置面板中配置 TTS 服务商后，可为每个智能体自定义音色。VoxCPM2 支持三种音色模式：Auto Voice（自动生成）、Prompt（自然语言描述）、Clone（上传参考音频）。

### Q: 环境变量修改后需要重启吗？

A: 是的，修改 `.env.local` 后需要重启开发服务器 (`pnpm dev`) 才能生效。

---

## 参与贡献

我们欢迎社区贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细流程。

### 快速贡献流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送分支 (`git push origin feat/amazing-feature`)
5. 提交 Pull Request

### AI 辅助贡献

使用 AI 工具（Codex, Claude, Cursor 等）生成的 PR 也欢迎！请：
- 在 PR 描述中标注 AI 辅助
- 提交前自行运行 AI 代码审查
- 确保理解提交的代码

---

## 许可证

本项目基于 [GNU Affero General Public License v3.0](LICENSE) 开源。

商业授权合作请联系：**thu_maic@tsinghua.edu.cn**

---

## 引用

如果 OpenMAIC 对您的研究有帮助，请考虑引用：

```bibtex
@Article{JCST-2509-16000,
  title = {From MOOC to MAIC: Reimagine Online Teaching and Learning through LLM-driven Agents},
  journal = {Journal of Computer Science and Technology},
  year = {2026},
  doi = {10.1007/s11390-025-6000-0},
  url = {https://jcst.ict.ac.cn/en/article/doi/10.1007/s11390-025-6000-0},
  author = {Ji-Fan Yu and Daniel Zhang-Li and Zhe-Yuan Zhang and Yu-Cheng Wang and Hao-Xuan Li and Joy Jia Yin Lim and Zhan-Xin Hao and Shang-Qing Tu and Lu Zhang and Xu-Sheng Dai and Jian-Xiao Jiang and Shen Yang and Fei Qin and Ze-Kun Li and Xin Cong and Bin Xu and Lei Hou and Man-Li Li and Juan-Zi Li and Hui-Qin Liu and Yu Zhang and Zhi-Yuan Liu and Mao-Song Sun}
}
```
