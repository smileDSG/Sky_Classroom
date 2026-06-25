# Generation Requirements

## Scene Information

- **Title**: {{title}}
- **Description**: {{description}}
- **Key Points**:
  {{keyPoints}}

{{teacherContext}}

## Available Resources

{{#if mediaElementEnabled}}
- **Available Media**: {{assignedImages}}
{{/if}}
- **Canvas Size**: {{canvas_width}} x {{canvas_height}} px

## Course Theme

{{themeDirective}}

## Output Requirements

Based on the scene information above, generate a complete Canvas/PPT component for one page.
Choose one clean OpenMAIC classroom layout recipe from the system prompt and make the slide look like the provided GIF reference style: white or very light background, image + text balance, thin dividers, and minimal colored background boxes.
The page must visually match the Course Theme above; the theme colors are not suggestions.

## Slide Richness Contract

Before returning JSON, verify the page has:

- A dominant visual anchor: image/media, chart, table, large formula, or diagram made from shapes and arrows
- At least 4 meaningful learning text blocks: title, focus, explain/detail, apply/takeaway
- Clear font hierarchy: title 30-38px, important labels 20-24px, body/takeaway 18-20px
- Around 8-12 purposeful elements when the scene is a normal teaching slide
- No text-only layout unless the scene is explicitly a quote or pure reading page
- Use at most one pale panel. Prefer thin dividers and plain text over colored cards or strips.
- No foreground callout may overlap earlier content. Prefer a plain text takeaway; for a bottom strip, reserve a clean band and keep all main content at least 12px above it.

## Language Directive
{{languageDirective}}

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
6. Keep slide text concise and visual; put spoken explanation in notes/actions, not on the slide
7. Use one consistent font family for all text: `Noto Sans SC, Microsoft YaHei, PingFang SC, Source Han Sans SC, Arial, sans-serif`
8. Prefer a strong visual composition: image + caption, formula + interpretation, or diagram + takeaways. Avoid text-only layouts.
9. If a formula is near the bottom of the page, move it upward or increase its container height so it is fully visible.
10. Add an application cue or takeaway only when space allows; keep it as plain text with a thin divider whenever possible. It must never cover existing content.

**Output Structure Example**:
{"background":{"type":"solid","color":"#ffffff"},"elements":[{"id":"title_001","type":"text","left":105,"top":78,"width":790,"height":70,"content":"<p style=\"font-size:34px;\"><strong>Title Content</strong></p>","defaultFontName":"","defaultColor":"#172033"},{"id":"rule_001","type":"shape","left":105,"top":154,"width":790,"height":2,"path":"M 0 0 L 1 0 L 1 1 L 0 1 Z","viewBox":[1,1],"fill":"#2f80d1","fixedRatio":false},{"id":"visual_001","type":"image","left":110,"top":190,"width":430,"height":242,"src":"img_1"},{"id":"content_001","type":"text","left":590,"top":205,"width":300,"height":130,"content":"<p style=\"font-size:20px;\"><strong>Focus point</strong></p><p style=\"font-size:18px;\">- Point one</p><p style=\"font-size:18px;\">- Point two</p><p style=\"font-size:18px;\">- Point three</p>","defaultFontName":"","defaultColor":"#333333"}]}
