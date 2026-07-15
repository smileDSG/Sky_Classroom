# Generation Requirements

## Scene Information

- **Title**: {{title}}
- **Scene Order**: {{order}}
- **Description**: {{description}}
- **Key Points**:
  {{keyPoints}}

{{teacherContext}}

## Available Resources

{{#if mediaElementEnabled}}
- **Available Media**: {{assignedImages}}
{{/if}}
- **Canvas Size**: {{canvas_width}} × {{canvas_height}} px

## Output Requirements

Based on the scene information above, generate a complete Canvas/PPT component for one page.

## Language Directive
{{languageDirective}}

Chinese-only hard rules:
- 所有可见文字必须使用简体中文；把英文标题、英文小节名、英文解释翻译成中文。
- Redis、Lua、MULTI、EXEC、DISCARD、WATCH 等技术名词可以保留英文，但必须放在中文解释中，不能整句英文。
- 不要输出 `Advanced Features`、`Transaction Commands`、`Atomic server-side logic`、`optimistic locking` 这类纯英文可见文本。
- 不要使用只有“要点一 / 要点二 / Step 1”这类空泛标签的卡片；每张卡片标题和正文都要有具体教学含义。

Content density hard rules:
- 不要生成内容单薄的大留白页面。除标题/副标题外，至少提供 4 个具体教学信息单元。
- 如果正文少于 120 个中文字符，必须加入一个视觉锚点：流程图、对照表、命令序列、结构关系图、公式/代码块之一。
- 对 Redis / 编程主题，优先使用“命令序列 + 场景解释 + 注意点 + 小结”的组合，而不是两个空卡片。

Operational teaching substance hard rules:
- For SQL / database / programming operation slides, never show only keywords such as SELECT, FROM, WHERE, ORDER BY, Step 1, or API names.
- Such slides must include one realistic syntax/command example, one short explanation of what each key part does, one result/execution-order note, and one caution or checkpoint.
- A visual anchor does not count as teaching substance by itself. Every keyword in a card, flow, table, or diagram must be paired with a short explanation, example, result, or caution.
- Prefer compact teaching text over empty cards: syntax + example + meaning + check is better than two large cards with only labels.
Deck diversity hard rules:
- Use Scene Order to choose a page-specific main composition.
- Do not reuse the same main composition as a generic 2x2 card grid or title-only card page.
- Vary the visual anchor by content: table, flow, command diagram, comparison band, formula stage, or structure diagram.
- Keep the palette clean and blue-related; avoid orange decorative bars, stripes, and unrelated corner ornaments.

{{layoutContract}}

**Must Follow**:

1. Output pure JSON directly, without any explanation or description
2. Do not wrap with ```json code blocks
3. Do not add any text before or after the JSON
4. Ensure the JSON format is correct and can be parsed directly
{{#if imageElementEnabled}}
- Use only the provided image IDs (for example, `img_1`) for source image `src` fields
{{/if}}
{{#if generatedVideoEnabled}}
- Use only the provided generated video media refs for video `mediaRef` fields
{{/if}}
5. All TextElement `height` values must be selected from the quick reference table in the system prompt

**Output Structure Example**:
{"background":{"type":"solid","color":"#ffffff"},"elements":[{"id":"title_001","type":"text","left":60,"top":50,"width":880,"height":76,"content":"<p style=\"font-size:32px;\"><strong>Title Content</strong></p>","defaultFontName":"","defaultColor":"#333333"},{"id":"content_001","type":"text","left":60,"top":150,"width":880,"height":130,"content":"<p style=\"font-size:18px;\">• Point One</p><p style=\"font-size:18px;\">• Point Two</p><p style=\"font-size:18px;\">• Point Three</p>","defaultFontName":"","defaultColor":"#333333"}]}
