# 智眸无界（OpenMAIC）部署到 AutoDL 无卡实例

> 适用：AutoDL 无卡开机 / CPU 实例，通过 JupyterLab Terminal 操作
> 日期：2026-09-08

---

## 快速通道（推荐）

已经写好了两个一键脚本，绝大多数情况照这三个文件走就行，本文剩下的部分当作排错手册：

| 文件 | 作用 | 何时跑 |
|---|---|---|
| `scripts/autodl/setup.sh` | 装环境 + 装依赖 + 编译 | 只跑一次 |
| `scripts/autodl/start.sh` | 启动 + 自检 | 每次开机后 |
| `scripts/autodl/env.autodl.template` | 精简环境变量模板 | setup 时自动复制 |

**详细三步走 → 见 `scripts/autodl/README.md`**

下面是从零讲清每一步的完整版，出问题再来这里查。

---

## 0. 先说清楚：它跟 hello-world 不是一个量级

上一个测试里的 `main.py` 是「一个 Python 文件 + 两个接口」。
本项目是 **Next.js 16 全栈应用**，差别有三条，决定了后面所有步骤：

| | hello-world | 智眸无界 |
|---|---|---|
| 运行环境 | Python | **Node.js ≥ 20.9 + pnpm 10.28** |
| 能不能直接跑 | 能 | **不能，必须先"编译"（`pnpm build`）** |
| 额外依赖 | 无 | **LibreOffice + 中文字体**（PPTX→PNG 要用） |

所以流程是：**装环境 → 装依赖 → 编译 → 启动 → 映射端口**。

---

## 1. 第一条硬约束：AutoDL 里跑不了 Docker

AutoDL 给你的「实例」本身就是一个容器，容器里再起 Docker 需要特权，
**绝大多数情况下 `docker` 命令不可用**。

先确认一下：

```bash
which docker && docker info 2>&1 | head -5
```

- 如果报 `command not found` 或 `Cannot connect to the Docker daemon` → **走下面的原生路线**（推荐）
- 如果真能用 → `sed -i 's/3000:3000/6006:3000/' docker-compose.yml && docker compose up --build` 即可

---

## 2. 前置检查（先跑一遍，别跳过）

```bash
free -h                       # 内存：build 阶段建议 ≥ 8G，低于 4G 必崩
df -h /root /root/autodl-tmp  # 磁盘：约需 5G（依赖 + 构建产物）
node -v 2>/dev/null || echo "no node"
```

**内存不够的救命办法（加 swap）：**

```bash
fallocate -l 8G /root/swapfile && chmod 600 /root/swapfile
mkswap /root/swapfile && swapon /root/swapfile
```

---

## 3. 步骤 ①：把源码放到数据盘

`/root/autodl-tmp` 是持久盘，放这里重启不丢；系统盘空间小且可能被重置。

```bash
mkdir -p /root/autodl-tmp && cd /root/autodl-tmp
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
```

> 如果 GitHub 很慢：在你自己电脑上把源码打个 zip（**务必排除 `node_modules`、`.next`、`.git`**），
> 用 JupyterLab 左边文件树的上传按钮传上去，然后 `unzip`。

---

## 4. 步骤 ②：装运行环境

### 4.1 Node + pnpm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install 22
node -v          # 应该是 v22.x

corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm -v          # 应该是 10.28.0
```

### 4.2 系统依赖（编译原生模块 + 渲染）

```bash
apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    libreoffice \
    fonts-noto-cjk fonts-wqy-zenhei

fc-cache -fv
```

> **中文字体必装**，否则导出的 PPT 预览图里中文全是方块。
> 验证：`soffice --version` 能打出版本号就对了。

### 4.3 换国内镜像（不然装到天亮）

```bash
pnpm config set registry https://registry.npmmirror.com
```

---

## 5. 步骤 ②：装依赖

```bash
pnpm install --frozen-lockfile
```

**这里会花 10–20 分钟**，因为 `postinstall` 要现场编译 4 个本地包
（`mathml2omml`、`pptxgenjs`、`@maic/dsl`、`@maic/renderer`）。

看到 `Done in ...` 或者包数没报错就成功了。

---

## 6. 配置环境变量（决定你能不能"生成课程"）

```bash
cp .env.example .env.local
```

至少填这几项（用 `nano .env.local` 或 JupyterLab 里双击编辑）：

```ini
# 体验账号 admin / 123（默认开启，无需额外配置）

# 至少填一个大模型的 key，否则"生成课程"按钮点不动
# 国内便宜好用的：DeepSeek / 智谱(智谱填 GLM_) / 月之暗面(填 KIMI_)
DEEPSEEK_API_KEY=sk-你的key

# 指定默认模型，省得界面上选
DEFAULT_MODEL=deepseek:deepseek-chat

# 公网暴露，务必加一道访问码
ACCESS_CODE=你自己想一个口令
```

> **零密钥也能开机**：什么都不填也能起来、能看界面、能播内置演示课，
> 只是不能现场生成新课。

---

## 7. 步骤 ③：编译

```bash
NODE_OPTIONS=--max-old-space-size=6144 pnpm build
```

成功标志：出现 `✓ Compiled successfully` 和 `Generating static pages (xx/xx)`。
失败最常见原因是内存不足 —— 回到第 2 节加 swap。

---

## 8. 步骤 ④：启动（端口必须是 6006）

**这是 AutoDL 最关键的一条**：公网只映射 **6006** 和 **6008** 两个端口，
默认的 3000 外面访问不到。

```bash
cd /root/autodl-tmp/OpenMAIC
nohup env PORT=6006 HOSTNAME=0.0.0.0 NODE_ENV=production pnpm start > app.log 2>&1 &
```

自检（**必须先在机器内部验证**）：

```bash
sleep 10
curl -s http://127.0.0.1:6006/ | head -c 300
tail -f app.log      # 看日志，Ctrl+C 退出
```

能打出一段 HTML 就说明服务起来了。

**停止 / 重启：**

```bash
pkill -f "next start" ; pkill -f "next-server"
# 然后重新执行上面的 nohup 命令
```

---

## 9. 步骤 ⑤⑥：从公网访问

### 路线 A：控制台「自定义服务」

AutoDL 控制台 → 实例卡片 → **自定义服务** → 弹出
`https://u39-xxx.seetacloud.com:8443` → 浏览器打开。

### 路线 B：自定义服务打不开（西北B区可能要企业认证）

用 SSH 隧道，在你**自己电脑**的终端执行（不是服务器里）：

```bash
ssh -p <实例卡片上的端口> root@<实例卡片上的host> -L 6006:127.0.0.1:6006 -N
```

然后本地浏览器打开 `http://127.0.0.1:6006`。

---

## 10. 常见问题速查

| 现象 | 原因 | 解决 |
|---|---|---|
| 页面一片空白 / 打不开 | 端口不是 6006 | 确认启动命令里有 `PORT=6006` |
| `Cannot find module` / 白屏 404 | 没 build 就 start | 重跑 `pnpm build` |
| build 到一半 `Killed` | 内存不足 | 加 8G swap |
| PPT 预览图中文是方块 | 缺中文字体 | `apt-get install fonts-noto-cjk fonts-wqy-zenhei && fc-cache -fv` |
| 点"生成课程"没反应 | 没配 LLM key | 填 `.env.local` 里的 API key，重启服务 |
| 页面被 iframe 拦截 | CSP `frame-ancestors 'self'` | `.env.local` 加 `ALLOWED_FRAME_ANCESTORS=https://xxx.seetacloud.com` 并重启 |
| 重启实例后服务没了 | 进程不自动拉起 | 重跑第 8 节的 `nohup` 命令；或写进开机脚本 |

---

## 11. 一句提醒

AutoDL 无卡实例**按小时计费**，挂着就要钱，而且关机再开进程会丢、要手动重启。
如果只是为了给评委演示：

- 短期演示 → 用这套，演示完关机
- 长期挂着 → 不如本地跑 + 内网穿透，或者录屏 + 本地演示更省心
