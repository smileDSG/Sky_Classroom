#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
打包 智眸无界 竞赛第2项交付物：
  22016688多智能体运行版.zip
特点：
  - 剔除构建产物 / 依赖 / 重复副本 / 临时草稿 / 真实密钥 / 日志
  - 强制 UTF-8 文件名（保留 public/avatars/ 中文名）
  - 注入一个「安全 .env.local」（无密钥、启用演示账号），保证 docker compose up 开箱即跑
  - 附带 DELIVERABLE.md（评委零密钥优先的使用说明）
"""
import os
import zipfile
import datetime

SRC = r"E:\01_Work\sky-classroom"
OUT = os.path.join(SRC, "22016688多智能体运行版.zip")

# ---- 排除目录（basename 命中即跳过）----
EXCLUDE_DIR_BASENAME = {
    "node_modules", ".next", ".git", ".worktrees", "software-cup-A3",
    ".codex", ".claude", ".codex-runtime", ".gstack", ".superpowers",
    ".mimocode", ".planning", ".agents", ".artifacts", ".pnpm-store",
    "test-results", "logs", "tmp", "outputs", "coverage", ".vercel",
    ".data", "__pycache__", ".idea", ".vscode",
    # 内部/运行时目录（不属交付物，且含内部信息与品牌残留）
    ".workbuddy", "temp",
    # 评估/测试/构建辅助目录（运行交付物不需要，且显著瘦身）
    "eval", "evals", "e2e", "node_modules",
}

# ---- 排除特定临时/草稿目录（路径任意层命中即跳过）----
EXCLUDE_DIR_NAME_PARTS = {".tmp", "tmp-deeptutor", "_pkg_build", "_validate"}

# ---- 排除文件 basename ----
EXCLUDE_FILE_BASENAME = {
    ".env.local", "cookies.txt", ".DS_Store", "Thumbs.db",
}

# ---- 排除文件后缀 ----
EXCLUDE_FILE_SUFFIX = {
    ".log", ".tmp", ".zip",
}

# ---- 额外排除的顶层大文件（已存在的交付物本身）----
EXCLUDE_TOPLEVEL_FILES = {
    "22016688源码.zip", "22016688作品.zip", "22016688多智能体运行版.zip",
    "dev-server.log", "dev-server.err.log",
}


def is_excluded(root_rel: str, name: str, is_dir: bool) -> bool:
    parts = root_rel.split(os.sep) if root_rel else []
    if is_dir:
        if name in EXCLUDE_DIR_BASENAME:
            return True
        if any(p in EXCLUDE_DIR_NAME_PARTS for p in parts) or name in EXCLUDE_DIR_NAME_PARTS:
            return True
        return False
    else:
        if name in EXCLUDE_FILE_BASENAME:
            return True
        if any(name.endswith(s) for s in EXCLUDE_FILE_SUFFIX):
            return True
        return False


def safe_rel(path: str) -> str:
    """生成 zip 内成员名（用 '/' 分隔，兼容各平台解压）。"""
    rel = os.path.relpath(path, SRC)
    return rel.replace(os.sep, "/")


# 顶层包裹目录（解压后所有内容位于此目录下，便于评委 cd 进入）
WRAP = "sky_classroom-multiagent"


def main():
    # 安全 .env.local 内容（无密钥，启用演示账号）
    env_local = (
        "# ============================================================\n"
        "# 智眸无界 演示环境配置（零密钥即可运行）\n"
        "# 本文件已随交付包提供，直接 `docker compose up` 即可使用。\n"
        "# 如需使用 AI「生成新课」，请在下方填写至少一个模型提供商 Key，\n"
        "# 或复制 model-deploy/ 下的示例为 server-providers.yml。\n"
        "# ============================================================\n\n"
        "# 体验账号：用户名 admin / 密码 123\n"
        "# 评委也可不登录，直接访问 /sky/software-cup 体验零密钥多智能体演示。\n"
        "# 默认模型（仅「生成新课」时需要；零密钥演示不依赖它，留空即可）\n"
        "# DEFAULT_MODEL=google:gemini-2.0-flash\n\n"
        "# ---- 按需填写，留空不影响软件杯零密钥演示 ----\n"
        "# DEEPSEEK_API_KEY=\n"
        "# OPENAI_API_KEY=\n"
        "# ANTHROPIC_API_KEY=\n"
        "# 更多见 .env.example 与 model-deploy/ 目录\n"
    )

    count = 0
    total_bytes = 0
    skipped = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, strict_timestamps=False) as z:
        # 1) 先注入安全 .env.local
        z.writestr(f"{WRAP}/.env.local", env_local)
        count += 1
        # 2) 遍历源码树
        for root, dirs, files in os.walk(SRC):
            rel_root = safe_rel(root)
            # 原地过滤 dirs，避免递归进排除目录
            dirs[:] = [d for d in dirs if not is_excluded(rel_root, d, True)]
            for fn in files:
                if is_excluded(rel_root, fn, False):
                    skipped += 1
                    continue
                # 顶层额外排除
                if rel_root == "." and fn in EXCLUDE_TOPLEVEL_FILES:
                    skipped += 1
                    continue
                full = os.path.join(root, fn)
                arcname = f"{WRAP}/" + safe_rel(full)
                try:
                    info = zipfile.ZipInfo(arcname, date_time=(1980, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    with open(full, "rb") as f:
                        data = f.read()
                    z.writestr(info, data)
                    count += 1
                    total_bytes += len(data)
                except Exception as e:  # 单个文件失败不影响整体
                    print(f"[WARN] skip {arcname}: {e}")
    size_mb = total_bytes / 1024 / 1024
    print(f"DONE: {count} files, {size_mb:.1f} MB -> {OUT}")
    print(f"skipped (excluded): {skipped}")


if __name__ == "__main__":
    main()
