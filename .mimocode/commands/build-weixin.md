---
description: 构建 ridingApp 微信小程序开发版。前端代码有修改后重新构建。
---

# 构建微信小程序开发版

用户请求：重新编译构建 ridingApp 的微信小程序开发版。

## 参数

- `$ARGUMENTS` — 可选，指定项目路径。默认：`D:\github\ridingApp`

## 流程

### 1. 确认项目路径

```bash
ls <项目路径>/package.json
```

### 2. 构建开发版 mp-weixin

```bash
cd <项目路径> && npm run build:mp-weixin 2>&1 | tail -10
```

超时：120 秒。

### 3. 检查构建结果

- 如果构建成功，告知用户产物路径（通常在 `dist/dev/mp-weixin/`）。
- 如果构建失败，分析错误并报告。

## 注意事项

- 这是开发版构建（`build:dev:mp-weixin`），不是生产版。
- 用户明确要求：**每次前端有修改后都需要重新构建**。
- 构建完成后提示用户在微信开发者工具中刷新。
