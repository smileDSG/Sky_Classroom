# Widget Teacher Actions Generator

Generate teacher action sequences for interactive widgets.

---

## Action Types

| Type | Description | Usage |
|------|-------------|-------|
| `speech` | Voice narration | Explain concepts, give hints |
| `highlight` | Spotlight element | Draw attention to UI elements |
| `annotation` | Floating label | Point to specific parts |
| `reveal` | Show hidden content | Progressive reveal |
| `setState` | Set widget state | Demonstrate scenarios |

---

## Output Schema

```json
{
  "actions": [
    { "id": "intro", "type": "speech", "content": "Let's explore how angle affects trajectory", "label": "Start" },
    { "id": "highlight_angle", "type": "highlight", "target": "#angle-slider", "content": "This slider controls the launch angle", "label": "Highlight angle" },
    { "id": "demo_angle60", "type": "setState", "state": { "angle": 60, "velocity": 25 }, "content": "", "label": "Set angle to 60°" }
  ]
}
```

**ID Naming Convention**: Use descriptive, unique IDs like `intro`, `highlight_angle`, `demo_angle60` instead of sequential numbers.

---

## Target Element ID Conventions

### Simulation widgets:
- Sliders: `#{variable_name}-slider` (e.g., `#angle-slider`, `#velocity-slider`)
- Value displays: `#{variable_name}-display`
- Buttons: `#start-btn`, `#reset-btn`, `#pause-btn`

### Diagram widgets:
- Nodes: `#n1`, `#n2`, `#n3` (matching node IDs)
- Edges: `#edge-n1-n2`

### Game widgets:
- Game controls: `#game-container`, `#score-display`
- Answer buttons: `.answer-btn`

### Code widgets:
- Editor: `#code-editor`
- Output: `#output-panel`
- Test results: `#test-results`

### 3D Visualization widgets:
- Camera controls: `#camera-controls`
- 3D objects: Use object ID directly (e.g., `"sun"`, `"earth"`)
- Sliders: `#{param}-slider` (e.g., `#speed-slider`, `#scale-slider`)
- Buttons: `#play-btn`, `#pause-btn`, `#reset-btn`
- Info panel: `#info`

---

## 3D Visualization State Examples

```json
{ "id": "focus_earth", "type": "setState", "state": { "cameraTarget": "earth", "cameraPosition": { "x": 0, "y": 5, "z": 15 } }, "content": "Let's take a closer look at Earth", "label": "Focus Earth" }
```

```json
{ "id": "highlight_sun", "type": "highlight", "target": "sun", "content": "The Sun contains 99.86% of the solar system's mass", "label": "Highlight Sun" }
```

---

## Rules

1. Create 3-7 actions per widget
2. Start with a speech action to introduce the widget
3. Use clear, short labels (2-4 words)
4. Target elements MUST use CSS selectors matching the widget's HTML
5. Include `content` for highlight/annotation actions to explain what's being shown
6. For `setState`, use variable names that match the widget's configuration exactly
7. Language must match the course language
8. Variable names in `setState` should match the widget's variable definitions exactly

---

---

## Generation Requirements

**Widget Type**: {{widgetType}}
**Widget Description**: {{description}}
**Key Points**: {{keyPoints}}
**Widget Config**: {{widgetConfig}}

**Language Directive (CRITICAL — all content must follow this)**: {{languageDirective}}

Generate 3-7 teacher actions that guide the student through this widget.

**IMPORTANT**:
- For `setState` actions, use the EXACT variable names from the widget config above
- For `highlight`/`annotation` targets, use selectors matching the element ID convention:
  - Sliders: `#{variable_name}-slider`
  - Displays: `#{variable_name}-display`
  - Nodes (diagrams): `#n1`, `#n2`, etc.

## Output Format

Return ONLY valid JSON, no markdown fences.
