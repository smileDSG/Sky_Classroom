---
name: math-render-fix
description: 数学公式渲染问题诊断与修复。当用户报告拍照搜题、解题详解、步骤中 LaTeX/数学公式显示异常时使用。覆盖 KaTeX 渲染错误、LaTeX 语法修复、OMML 转换问题。
---

# 数学公式渲染修复

## 适用场景

用户报告 OpenMAIC 拍照搜题模块中数学公式渲染异常，包括：
- 积分、级数、圆锥曲线等复杂公式显示错误
- LaTeX 语法解析失败
- KaTeX 渲染报错
- 解题详解/步骤中公式显示为原始文本

## 关键文件

| 文件 | 职责 |
|------|------|
| `components/sky/solve/math-renderer.tsx` | 数学公式渲染组件，包含 `fixCommonLatexErrors` 等修复函数 |
| `components/sky/solve/solve-page.tsx` | 解题页面主组件 |
| `components/sky/solve/solution-panel.tsx` | 解题详解面板 |
| `lib/solve/solver-prompts.ts` | 求解器 prompt 定义 |
| `lib/solve/solver-agent.ts` | 求解器 agent 逻辑 |
| `lib/solve/four-part-output.ts` | 四部分输出格式化 |
| `app/api/sky/solve/recognize/route.ts` | 图片识别 API |
| `app/api/sky/solve/explain-stream/route.ts` | 解题详解流式 API |
| `lib/solve/solve-graph.ts` | 求解流程图 |
| `lib/solve/types.ts` | 类型定义 |

## 诊断流程

### 1. 确认问题类型

询问或观察用户报告的具体问题：
- 公式完全不显示？→ 检查 KaTeX 是否加载
- 公式显示为原始 LaTeX？→ 检查渲染组件是否被调用
- 公式显示错误（缺字符、错位）→ 检查 LaTeX 语法修复逻辑
- 特定公式类型出错（如 `\frac`、`\int`、`\sum`）→ 针对性修复

### 2. 检查 fixCommonLatexErrors 函数

该函数在 `math-renderer.tsx` 中，负责修复常见的 LaTeX 语法问题：
- 检查是否覆盖了用户报告的公式类型
- 添加缺失的修复规则

### 3. 常见修复模式

```typescript
// 修复 \frac 缺少花括号
latex = latex.replace(/\\frac\s*([^{}])\s*([^{}])/g, '\\frac{$1}{$2}');

// 修复 \sqrt 缺少花括号
latex = latex.replace(/\\sqrt\s*([^{}\[])/g, '\\sqrt{$1}');

// 修复不匹配的括号
// 修复中文字符在公式中的干扰
// 修复 AI 生成的 LaTeX 中常见的语法错误
```

### 4. 测试验证

使用测试页面验证修复效果：
```bash
curl -s http://localhost:3000/sky/solve/math-test
```

或直接在浏览器中访问 `http://localhost:3000/sky/solve/math-test`。

### 5. 回归检查

修复后运行相关测试：
```bash
cd "d:\github\OpenMAIC-firsted-team-" && npx vitest run tests/solve/ 2>&1
```

## 注意事项

- 修改 `math-renderer.tsx` 后需要刷新浏览器查看效果。
- LaTeX 修复规则应尽量精确，避免误伤正常公式。
- 如果问题出在 AI 生成的 LaTeX 质量差，可能需要同时修改 `solver-prompts.ts` 中的 prompt。
- 每次修复后提供测试页面 URL 供用户验证。
