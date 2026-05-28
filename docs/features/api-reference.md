# 天空课堂 API 参考文档

## 1. 解题模块

### 1.1 图片识别

```
POST /api/sky/solve/recognize
```

**请求**: `FormData`
| 字段 | 类型 | 说明 |
|------|------|------|
| `image` | File | 题目图片 |

**响应**:
```json
{
  "success": true,
  "data": {
    "text": "解方程: 2x + 3 = 9",
    "latex": null,
    "problemCount": 1,
    "problems": [{ "text": "解方程: 2x + 3 = 9" }]
  }
}
```

### 1.2 解题讲解

```
POST /api/sky/solve/explain
```

**请求**:
```json
{
  "problem": { "text": "解方程: 2x + 3 = 9", "image": null },
  "agentId": "science",
  "useHighPrecision": false,
  "outputFormat": "four-part"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "answer": "x = 3",
    "steps": [{ "label": "移项", "content": "2x = 6", "keyPoints": ["等式两边同时减去3"] }],
    "knowledgePoints": [{ "name": "一元一次方程", "description": "基础代数", "difficulty": "easy" }],
    "similarQuestions": [{ "problem": "3x + 6 = 15", "difficulty": 0.4, "knowledgePoint": "一元一次方程" }]
  },
  "fromQuestionBank": false,
  "solvingTime": 5200,
  "agentsUsed": ["science"]
}
```

### 1.3 批改

```
POST /api/sky/solve/grade
```

**请求**:
```json
{
  "problem": "解方程: 2x + 3 = 9",
  "correctAnswer": "x = 3",
  "userAnswer": "x = 5",
  "stepByStep": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "isCorrect": false,
    "score": 0.3,
    "cause": "calculation-error",
    "causeLabel": "计算错误",
    "explanation": "解题思路正确，但计算有误",
    "partialCredit": [
      { "step": 1, "score": 0.5, "comment": "移项正确" },
      { "step": 2, "score": 0.1, "comment": "计算错误" }
    ]
  }
}
```

## 2. 题库模块

### 2.1 题库查询

```
GET /api/sky/question-bank?query=一元一次方程&limit=10
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "qb_abc123",
      "problemText": "解方程: 2x + 3 = 9",
      "answer": "x = 3",
      "agentId": "science",
      "verified": true,
      "solvedAt": 1747641600000
    }
  ],
  "count": 42
}
```

### 2.2 题库入库

```
POST /api/sky/question-bank
```

**请求**:
```json
{
  "problemText": "解方程: 3x + 1 = 7",
  "answer": "x = 2",
  "steps": ["移项", "计算"],
  "knowledgePoints": ["一元一次方程"],
  "agentId": "science"
}
```

## 3. 幻灯片模块

### 3.1 生成幻灯片

```
POST /api/sky/slides/generate
```

**请求**:
```json
{
  "topic": "一元一次方程",
  "difficulty": "junior",
  "slideCount": 5
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "slides": [
      { "id": "slide-1", "title": "一元一次方程", "content": "...", "layout": "title-content" }
    ]
  }
}
```

### 3.2 虚拟形象讲解

```
POST /api/sky/slides/avatar-speak
```

**请求**:
```json
{
  "slides": [{ "id": "slide-1", "title": "...", "content": "..." }],
  "avatarId": "professor"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "avatarId": "professor",
    "avatarName": "严肃教授",
    "scripts": [
      { "slideId": "slide-1", "text": "同学们好...", "audioUrl": "https://...", "highlights": [] }
    ],
    "totalDuration": 12.5
  }
}
```

### 3.3 导出 PPTX

```
POST /api/sky/slides/export-pptx
```

**请求**:
```json
{
  "slides": [...],
  "avatarId": "professor",
  "includeSpeakerNotes": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "fileUrl": "blob:...",
    "fileName": "一元一次方程.pptx"
  }
}
```

### 3.4 可用形象列表

```
GET /api/sky/slides/avatars
```

**响应**:
```json
{
  "success": true,
  "data": [
    { "id": "professor", "name": "严肃教授", "description": "...", "style": "serious" },
    { "id": "senior", "name": "温柔学姐", "description": "...", "style": "gentle" },
    { "id": "scholar", "name": "幽默学渣", "description": "...", "style": "humorous" }
  ]
}
```

## 4. 错题本模块

### 4.1 查询错题

```
GET /api/sky/mistakes?cause=calculation-error&limit=20
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "mistake_abc",
      "problem": "2x = 4",
      "userAnswer": "x = 1",
      "correctAnswer": "x = 2",
      "cause": "calculation-error",
      "causeLabel": "计算错误",
      "solvedAt": "2026-05-19T10:00:00Z",
      "reviewed": false,
      "reviewCount": 0,
      "knowledgePoints": ["代数"]
    }
  ]
}
```

### 4.2 新增错题

```
POST /api/sky/mistakes
```

### 4.3 标记已复习

```
PATCH /api/sky/mistakes/:id/review
```

### 4.4 删除错题

```
DELETE /api/sky/mistakes/:id
```

## 5. 知识图谱

```
GET /api/sky/knowledge-graph
```

**响应**:
```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "代数", "name": "代数", "category": "math", "mastery": 60, "problemCount": 5, "mistakeCount": 2 }
    ],
    "edges": [
      { "from": "代数", "to": "方程", "relation": "prerequisite" }
    ],
    "weakPoints": ["代数"]
  }
}
```

## 6. AI 助手

```
POST /api/sky/assistant/chat
```

**请求**:
```json
{
  "messages": [
    { "role": "user", "content": "我不太懂一元一次方程的解法" }
  ],
  "config": {
    "subject": "science",
    "difficulty": "junior",
    "style": "detailed"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "reply": "好的！一元一次方程的解法可以分为三步...",
    "context": {
      "relevantMistakes": 2,
      "weakPoints": ["代数"]
    }
  }
}
```
