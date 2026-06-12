---
description: 将远程 master 最新代码拉取到本地分支并解决冲突。支持 OpenMAIC 和 ridingApp/ridingAdmin 项目。
---

# Git 同步远程 master 到本地分支

用户请求：将远程 master 最新代码同步到当前分支，如有冲突则解决。

## 参数

- `$ARGUMENTS` — 可选，指定项目路径和目标分支。格式：`[项目路径] [目标分支]`

## 流程

### 1. 确认项目和分支

- 如果用户指定了项目路径，使用该路径；否则检测当前工作目录。
- 默认项目路径：`D:\github\OpenMAIC-firsted-team-`
- 默认目标分支：`Dev-ryx`（OpenMAIC）或当前分支（其他项目）

执行：
```bash
cd <项目路径> && git branch --show-current
```

### 2. 拉取远程最新代码

```bash
cd <项目路径> && git fetch origin
```

### 3. 合并远程 master

```bash
cd <项目路径> && git merge origin/master --no-commit --no-ff 2>&1
```

### 4. 处理冲突（如有）

如果合并产生冲突：
1. 列出冲突文件：`git diff --name-only --diff-filter=U`
2. 逐个解决冲突（保留用户代码优先，或按用户指示处理）
3. 标记解决：`git add <冲突文件>`
4. 完成合并：`git commit --no-edit`

如果无冲突，直接完成合并。

### 5. 推送到远程

```bash
cd <项目路径> && git push origin <目标分支>
```

### 6. 验证一致性

```bash
cd <项目路径> && git status
```

确认本地分支与远程 master 已同步，无落后提交。

## 注意事项

- `tsconfig.tsbuildinfo` 冲突通常可以安全地用远程版本覆盖（该文件是构建产物）。
- `.next/` 目录下的文件冲突应删除本地版本。
- 如果用户在 ridingApp 或 ridingAdmin 项目中，目标分支可能是 `main` 而非 `master`，需确认。
