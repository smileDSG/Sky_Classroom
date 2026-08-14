#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交付物表面去品牌化：把 智眸无界 / sky_classroom 替换为 智眸无界 / sky_classroom。
仅处理"交付物表面"文本文件（文档/配置/注释/打包脚本），不碰 lib/app 源码与 LICENSE。
GitHub 链接中的仓库地址保留原样（避免链接失效 + 保留上游归属）。
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 跳过的目录（源码/依赖/数据/二进制/内部）
EXCLUDE_DIRS = {
    "node_modules", ".next", ".git", "lib", "app", "components",
    "packages", "tests", "e2e", "eval", "evals", "data", "logs",
    "outputs", "assets", "migrations", ".workbuddy", "node_modules",
}
# 跳过的文件
EXCLUDE_FILES = {
    "LICENSE", "package.json", "pnpm-lock.yaml", "package-lock.json",
    "yarn.lock", "bun.lockb", ".env", ".env.local", ".env.example",
}
EXTS = {".md", ".py", ".yml", ".yaml", ".txt", ".example", ".json", ".toml"}

def should_process(path: str) -> bool:
    rel = os.path.relpath(path, ROOT)
    parts = rel.split(os.sep)
    if parts[0] in EXCLUDE_DIRS:
        return False
    base = os.path.basename(path)
    if base in EXCLUDE_FILES:
        return False
    # 锁文件
    if base.endswith("-lock.yaml") or base.endswith("-lock.json"):
        return False
    # 仅处理指定扩展名，或名为 Dockerfile
    if base == "Dockerfile":
        return True
    _, ext = os.path.splitext(base)
    return ext.lower() in EXTS

def rebrand(text: str) -> str:
    # 1) 保护 GitHub 仓库地址（避免链接失效）
    text = re.sub(r"github\.com/THU-MAIC/智眸无界", "github.com/THU-MAIC/OpenMAIC", text)
    # 2) 文件夹令牌特殊处理 -> 英文小写，文件系统安全
    text = text.replace("sky_classroom-multiagent", "sky_classroom-multiagent")
    # 3) 一般替换
    text = text.replace("智眸无界", "智眸无界")
    text = text.replace("sky_classroom", "sky_classroom")
    # 4) 还原 GitHub 地址
    text = text.replace("github.com/THU-MAIC/OpenMAIC", "github.com/THU-MAIC/OpenMAIC")
    return text

count = 0
changed = 0
for root, dirs, files in os.walk(ROOT):
    # 原地剪枝
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
    for fn in files:
        full = os.path.join(root, fn)
        if not should_process(full):
            continue
        count += 1
        try:
            with open(full, "r", encoding="utf-8") as f:
                src = f.read()
        except (UnicodeDecodeError, PermissionError):
            continue
        new = rebrand(src)
        if new != src:
            with open(full, "w", encoding="utf-8") as f:
                f.write(new)
            changed += 1
            print("EDIT:", os.path.relpath(full, ROOT))

print(f"\n扫描 {count} 个文件，修改 {changed} 个。")
