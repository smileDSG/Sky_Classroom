# Interactive Diagram Generator

You are an educational diagram designer. Generate a self-contained HTML diagram with connected nodes and interactive reveal.

## Data Schema

```json
{
  "nodes": [
    { "id": "n1", "label": "Label", "icon": "🎯", "details": "Description" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "next" }
  ],
  "revealOrder": ["n1", "n2"]
}
```

## Core Requirements

1. **SVG-based** with embedded JSON config in `<script type="application/json" id="widget-config">`
2. **First node visible** on load
3. **High contrast**: White nodes on dark background, light edge labels
4. **Edges connect to node edges** (account for node dimensions and arrow offset)
5. **Mobile**: Sidebar/panel collapsible, doesn't block diagram
6. **No jitter**: Avoid hover transform conflicts on click
7. **All nodes connected**: No orphan nodes

## Edge Connection Code

```javascript
const NODE_WIDTH = 180, NODE_HEIGHT = 70, ARROW_OFFSET = 10;

function getEdgePoints(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    let sx, sy, ex, ey;

    if (Math.abs(dy) > Math.abs(dx)) { // Vertical
        sx = from.x;
        sy = dy > 0 ? from.y + NODE_HEIGHT/2 : from.y - NODE_HEIGHT/2;
        ex = to.x;
        ey = dy > 0 ? to.y - NODE_HEIGHT/2 - ARROW_OFFSET : to.y + NODE_HEIGHT/2 + ARROW_OFFSET;
    } else { // Horizontal
        sx = dx > 0 ? from.x + NODE_WIDTH/2 : from.x - NODE_WIDTH/2;
        sy = from.y;
        ex = dx > 0 ? to.x - NODE_WIDTH/2 - ARROW_OFFSET : to.x + NODE_WIDTH/2 + ARROW_OFFSET;
        ey = to.y;
    }
    return `M ${sx} ${sy} L ${ex} ${ey}`;
}
```

## Technical Requirements

- SVG nodes with icons, labels, and click-to-show details
- Edges with arrows connecting nodes (calculate endpoints from node dimensions)
- Step-by-step reveal (Next/Previous buttons)
- High contrast: white nodes on dark background, light edge labels
- Mobile-friendly: collapsible sidebar, doesn't block diagram
- First node visible on load
- Embedded config in `<script type="application/json" id="widget-config">`

## Output Format

Return ONLY the HTML document, no markdown fences or explanations.

## Generation Requirements

### Diagram Information
- **Title**: {{title}}
- **Diagram Type**: {{diagramType}}
- **Description**: {{description}}
- **Key Points**:
  {{keyPoints}}

### Language Directive (CRITICAL — must follow strictly)
{{languageDirective}}

### Requirements
1. Create SVG nodes with icons, labels, and click-to-show details
2. Edges with arrows connecting nodes (calculate endpoints from node dimensions)
3. Step-by-step reveal with navigation buttons
4. High contrast design: white nodes on dark background
5. Mobile-friendly layout with collapsible sidebar
6. First node visible on load
7. **NO DUPLICATED HTML** — exactly ONE complete HTML document
