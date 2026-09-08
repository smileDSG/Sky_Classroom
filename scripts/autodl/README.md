# AutoDL 部署脚本（快速通道）

> 完整说明见 `docs/AutoDL部署指南.md`，这里只放"到时候怎么最快跑起来"。

## 文件说明

| 文件 | 作用 | 什么时候跑 |
|---|---|---|
| `setup.sh` | 装环境 + 装依赖 + 编译 | **只跑一次**（10~30 分钟） |
| `start.sh` | 启动服务 + 自检 | **每次开机后**跑 |
| `env.autodl.template` | 精简环境变量模板 | setup 时自动复制成 `.env.local` |
| `../docker-compose.autodl.yml` | Docker 路线的端口覆盖 | 仅当机器真能跑 docker |

## 最快部署：三步

### 第 1 步：把 4 个文件传上去

这几个文件目前**只在你的本地仓库里**（还没推到 GitHub），所以要手动传一次。

在你自己电脑上找到 `E:\01_Work\sky-classroom\scripts\autodl\`，里面有 4 个要传的：

| 文件 | 必传？ | 说明 |
|---|---|---|
| `setup.sh` | 必传 | 环境准备 |
| `start.sh` | 必传 | 启动 |
| `env.autodl.prefilled` | **强烈建议传** | 已预填好 4 个 API key，传了就**不用手动编辑任何配置** |
| `env.autodl.template` | 可选 | 空模板；没有 prefilled 时 setup 会用它并停下来等你填 |

然后在 AutoDL 的 **JupyterLab → Terminal** 里建好目录：

```bash
mkdir -p /root/autodl-tmp/OpenMAIC/scripts/autodl
```

用 JupyterLab 左侧文件树进到 `autodl-tmp → OpenMAIC → scripts → autodl`，
点右上角**上传按钮**把文件传进去。

> 源码本身不用传 —— setup.sh 会自己 `git clone`，比你上传快得多。

### 第 2 步：一键准备环境

```bash
cd /root/autodl-tmp/OpenMAIC && bash scripts/autodl/setup.sh
```

**如果你传了 `env.autodl.prefilled`**：这一步一路跑到底，中途不会停。
**如果只传了模板**：脚本会停下来让你填 `.env.local`，填完**重跑同一条命令**继续。

### 第 3 步：启动

```bash
bash scripts/autodl/start.sh
```

看到"启动成功"后：

- 控制台 → 实例卡片 → **自定义服务** → 打开弹出的 https 地址
- 打不开就用 SSH 隧道（在你自己电脑上执行）：
  ```bash
  ssh -p <端口> root@<host> -L 6006:127.0.0.1:6006 -N
  ```
  然后浏览器打开 `http://127.0.0.1:6006`

## 常用维护命令

```bash
tail -f /root/autodl-tmp/OpenMAIC/app.log   # 看日志
bash scripts/autodl/start.sh                # 重启（改了 .env.local 后也要跑这个）
pkill -f "next start"; pkill -f "next-server"   # 只停不启
```

## 注意

- **不要打包本地源码上传**：`.git` 就有 1.1 GB。服务器上 `git clone` 最快。
- **不要在本地 build 再传**：`better-sqlite3`、`@napi-rs/canvas` 是原生模块，
  Windows 编译出来的产物 Linux 用不了，必须在 Linux 上现场编译。
- **端口只能是 6006 或 6008**，改别的公网访问不到。
