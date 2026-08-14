#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对任意交付物文件夹做表面去品牌化 + 清理运行时垃圾。
用法：python3 rebrand_any.py <目标文件夹>
"""
import os
import re
import shutil
import sys

ROOT = sys.argv[1]

# 源码/依赖/构建产物/数据/二进制/日志/内部目录 —— 不处理品牌字
EXCLUDE_DIRS = {
    "node_modules", ".next", ".git", "lib", "app", "components",
    "packages", "tests", "e2e", "eval", "evals", "data", "logs",
    "outputs", "assets", "migrations", ".workbuddy", "public",
}

# 会清理的运行时/内部文件和目录
JUNK_DIRS = {"logs", ".workbuddy", ".tmp-deeptutor", "task"}
JUNK_FILES = {
    "dev-server.log", "dev-server.err.log", "progress.md",
    "findings.md", "task_plan.md", "tsconfig.tsbuildinfo",
}

# 不处理的文件
EXCLUDE_FILES = {
    "LICENSE", "package.json", "pnpm-lock.yaml", "package-lock.json",
    "yarn.lock", "bun.lockb",
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
    if base.endswith("-lock.yaml") or base.endswith("-lock.json"):
        return False
    if base == "Dockerfile":
        return True
    _, ext = os.path.splitext(base)
    return ext.lower() in EXTS


def rebrand(text: str) -> str:
    # 保护 GitHub 仓库地址，避免链接失效
    text = re.sub(
        r"github\.com/THU-MAIC/OpenMAIC",
        "__GITHUB_REPO_LINK__",
        text,
    )
    text = text.replace("OpenMAIC", "智眸无界")
    text = text.replace("openmaic", "sky_classroom")
    # 还原 GitHub 地址
    text = text.replace("__GITHUB_REPO_LINK__", "github.com/THU-MAIC/OpenMAIC")
    return text


def clean_junk():
    """删除运行时生成的垃圾目录/文件"""
    for root, dirs, files in os.walk(ROOT, topdown=False):
        rel_root = os.path.relpath(root, ROOT)
        if rel_root == ".":
            rel_root = ""
        parts = rel_root.split(os.sep) if rel_root else []
        # 删除垃圾文件
        for f in files:
            if f in JUNK_FILES:
                target = os.path.join(root, f)
                os.remove(target)
                print("DEL FILE:", os.path.relpath(target, ROOT))
        # 删除垃圾目录（仅当它是顶层垃圾目录时）
        for d in list(dirs):
            if d in JUNK_DIRS and (len(parts) == 0 or parts[0] not in EXCLUDE_DIRS):
                target = os.path.join(root, d)
                shutil.rmtree(target)
                print("DEL DIR:", os.path.relpath(target, ROOT))
                dirs.remove(d)


def main():
    # 清理运行时垃圾（在 WorkBuddy 沙箱内可能因安全删除 shim 失败，先跳过，只做去品牌化）
    # clean_junk()
    count = 0
    changed = 0
    for root, dirs, files in os.walk(ROOT):
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


if __name__ == "__main__":
    main()
