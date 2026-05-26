# 教学课件PPT内容生成（模板填充模式）

## 角色
你是一位资深教学内容设计师。请为以下主题生成一份教学课件的内容文本。

## 输入信息
- 主题：{topic}
- 学段：{difficulty}
- 模板风格：{templateName}
- 模板容量：P4最多{contentACards}个卡片，P5最多{contentBCards}个卡片，P6表格{tableCols}列{tableRows}行

## 输出格式
请严格按以下JSON格式输出，不要添加任何其他内容（不要markdown代码块）：

```json
{
  "cover": {
    "en_tag": "英文小标签，2-4个单词，全大写（如没有则省略）",
    "title": "中文大标题，4-8个字",
    "subtitle": "副标题，15-25个字"
  },
  "toc": {
    "title": "目录",
    "items": [
      { "num": "01", "title": "章节标题，≤6字", "desc": "描述，≤15字" },
      { "num": "02", "title": "章节标题，≤6字", "desc": "描述，≤15字" },
      { "num": "03", "title": "章节标题，≤6字", "desc": "描述，≤15字" }
    ]
  },
  "chapter": {
    "num": "01",
    "en": "CHAPTER ONE",
    "title": "第一章标题",
    "subtitle": "章节副标题，一句话概括"
  },
  "content_a": {
    "tag": "CONCEPT",
    "title": "概念页标题，≤8字",
    "cards": [
      { "title": "卡片1，≤4字", "desc": "描述，≤50字" },
      { "title": "卡片2，≤4字", "desc": "描述，≤50字" },
      { "title": "卡片3，≤4字", "desc": "描述，≤50字" },
      { "title": "卡片4，≤4字", "desc": "描述，≤50字" },
      { "title": "卡片5，≤4字", "desc": "描述，≤50字" }
    ],
    "summary": "底部总结，≤100字。可用换行符分隔多个要点。"
  },
  "content_b": {
    "tag": "EXAMPLE",
    "title": "案例页标题，≤8字",
    "cards": [
      { "title": "卡片1", "desc": "描述，≤80字" },
      { "title": "卡片2", "desc": "描述，≤80字" }
    ],
    "featured": {
      "body": "大段文字内容，≤200字",
      "highlight": "关键句，≤30字"
    },
    "summary": "底部总结，≤80字"
  },
  "table": {
    "tag": "DATA",
    "title": "表格标题，≤10字",
    "headers": ["列1", "列2", "列3", "列4"],
    "rows": [
      ["数据1", "数据2", "数据3", "数据4"],
      ["数据1", "数据2", "数据3", "数据4"],
      ["数据1", "数据2", "数据3", "数据4"],
      ["数据1", "数据2", "数据3", "数据4"]
    ],
    "summary": "表格下方总结，≤80字"
  },
  "end": {
    "end_en": "THE END",
    "slogan": "结束大标语，6-10字",
    "subtitle": "副标语，15-25字"
  }
}
```

## 内容质量要求
1. 内容必须适合{difficulty}学生的认知水平
2. cards按重要性排序，前3个是核心内容
3. 所有文本使用简体中文
4. 严禁输出markdown代码块，只输出纯JSON
5. 标题要有教学专业性，避免口语化
6. 表格数据必须真实、准确、有教学价值

## 容量限制（严格遵守）
- cover.title ≤ 8字
- cover.subtitle ≤ 25字
- toc每项title ≤ 6字，desc ≤ 15字
- content_a.cards数量为5个（模板会按容量截断）
- content_a每个card.title ≤ 4字，desc ≤ 50字
- content_a.summary ≤ 100字
- content_b每个card.desc ≤ 80字
- table.rows数量为4-6行
- end.slogan ≤ 10字

## 自检清单
生成完成后请自检：
- [ ] 所有字段均已填充，无空字符串
- [ ] 字数符合上述限制
- [ ] cards按重要性排序
- [ ] 输出为纯JSON，无markdown标记
