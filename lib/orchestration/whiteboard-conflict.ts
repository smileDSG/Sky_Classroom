/**
 * Whiteboard Conflict Prevention + Auto-Layout
 *
 * Proactive conflict detection and prevention for collaborative
 * whiteboard editing. Implements:
 * - Spatial conflict prediction before element placement
 * - Smart auto-layout that respects content type relationships
 * - Conflict resolution suggestions
 */

interface WhiteboardElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'chart' | 'latex' | 'table' | 'code';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface ConflictReport {
  hasConflict: boolean;
  conflicts: {
    elementId: string;
    overlapRatio: number;
    resolution: 'move' | 'resize' | 'layer' | 'none';
    suggestedPosition?: { x: number; y: number };
  }[];
}

interface LayoutResult {
  elements: WhiteboardElement[];
  totalWidth: number;
  totalHeight: number;
}

// ─── Spatial conflict detection ───

function calculateOverlap(a: WhiteboardElement, b: WhiteboardElement): number {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const overlapArea = xOverlap * yOverlap;
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}

/**
 * Detect conflicts between a proposed element and existing elements.
 */
export function detectConflicts(
  proposed: WhiteboardElement,
  existing: WhiteboardElement[],
  threshold = 0.15,
): ConflictReport {
  const conflicts: ConflictReport['conflicts'] = [];

  for (const el of existing) {
    if (el.id === proposed.id) continue;

    const overlap = calculateOverlap(proposed, el);
    if (overlap > threshold) {
      // Determine resolution strategy
      let resolution: ConflictReport['conflicts'][0]['resolution'] = 'move';

      // If overlap is minimal, suggest layering
      if (overlap < 0.3) {
        resolution = 'layer';
      }
      // If element is a chart/shape and proposed is text, suggest resize
      else if (proposed.type === 'text' && (el.type === 'chart' || el.type === 'shape')) {
        resolution = 'resize';
      }

      const suggestedPosition = {
        x: el.x + el.width + 20,
        y: el.y,
      };

      conflicts.push({
        elementId: el.id,
        overlapRatio: overlap,
        resolution,
        suggestedPosition,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

// ─── Auto-layout algorithms ───

/**
 * Grid layout: arranges elements in rows with automatic wrapping.
 */
export function gridLayout(
  elements: WhiteboardElement[],
  canvasWidth: number,
  spacing = 20,
): LayoutResult {
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const layout: WhiteboardElement[] = [];
  let currentX = spacing;
  let currentY = spacing;
  let rowMaxHeight = 0;

  for (const el of sorted) {
    if (currentX + el.width > canvasWidth - spacing) {
      currentX = spacing;
      currentY += rowMaxHeight + spacing;
      rowMaxHeight = 0;
    }

    layout.push({ ...el, x: currentX, y: currentY });
    rowMaxHeight = Math.max(rowMaxHeight, el.height);
    currentX += el.width + spacing;
  }

  return {
    elements: layout,
    totalWidth: canvasWidth,
    totalHeight: currentY + rowMaxHeight + spacing,
  };
}

/**
 * Smart auto-layout that groups related content types together.
 * - Text elements cluster at top-left
 * - Charts/graphs cluster at top-right
 * - Images cluster at bottom
 * - Code blocks get full-width rows
 */
export function smartAutoLayout(
  elements: WhiteboardElement[],
  canvasWidth: number,
  canvasHeight: number,
): LayoutResult {
  const spacing = 15;

  // Group by type
  const textEls = elements.filter((e) => e.type === 'text' || e.type === 'latex');
  const chartEls = elements.filter((e) => e.type === 'chart');
  const imageEls = elements.filter((e) => e.type === 'image');
  const codeEls = elements.filter((e) => e.type === 'code');
  const shapeEls = elements.filter((e) => e.type === 'shape');
  const tableEls = elements.filter((e) => e.type === 'table');

  const layout: WhiteboardElement[] = [];
  let cursorY = spacing;

  // Zone 1: Text content (top)
  if (textEls.length > 0) {
    const result = gridLayout(textEls, canvasWidth, spacing);
    for (const el of result.elements) {
      layout.push({ ...el, y: el.y + cursorY });
    }
    cursorY += result.totalHeight;
  }

  // Zone 2: Charts and tables (middle-left), Shapes (middle-right)
  const midElements = [...chartEls, ...tableEls, ...shapeEls];
  if (midElements.length > 0) {
    const leftElements = [...chartEls, ...tableEls];
    const rightElements = [...shapeEls];

    if (leftElements.length > 0) {
      const leftResult = gridLayout(leftElements, Math.floor(canvasWidth * 0.65), spacing);
      for (const el of leftResult.elements) {
        layout.push({ ...el, y: el.y + cursorY });
      }
      cursorY = Math.max(cursorY + leftResult.totalHeight, cursorY);
    }

    if (rightElements.length > 0) {
      const rightResult = gridLayout(rightElements, Math.floor(canvasWidth * 0.35), spacing);
      for (const el of rightResult.elements) {
        layout.push({ ...el, x: Math.floor(canvasWidth * 0.65) + el.x, y: cursorY });
      }
      cursorY += rightResult.totalHeight;
    }
  }

  // Zone 3: Images (bottom)
  if (imageEls.length > 0) {
    const result = gridLayout(imageEls, canvasWidth, spacing);
    for (const el of result.elements) {
      layout.push({ ...el, y: el.y + cursorY });
    }
    cursorY += result.totalHeight;
  }

  // Zone 4: Code blocks (full-width at bottom)
  for (const el of codeEls) {
    layout.push({
      ...el,
      x: spacing,
      y: cursorY,
      width: canvasWidth - spacing * 2,
    });
    cursorY += el.height + spacing;
  }

  return {
    elements: layout,
    totalWidth: canvasWidth,
    totalHeight: Math.min(cursorY + spacing, canvasHeight),
  };
}

/**
 * Preventive conflict check: given a proposed element and the current
 * layout, determine if placing it would cause a conflict and suggest
 * the best non-conflicting position.
 */
export function suggestPosition(
  proposed: WhiteboardElement,
  existing: WhiteboardElement[],
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; hasConflict: boolean } {
  const report = detectConflicts(proposed, existing);

  if (!report.hasConflict) {
    return { x: proposed.x, y: proposed.y, hasConflict: false };
  }

  // Try to find a free position by scanning in a grid pattern
  const gridStep = 20;
  for (let y = 0; y < canvasHeight - proposed.height; y += gridStep) {
    for (let x = 0; x < canvasWidth - proposed.width; x += gridStep) {
      const testEl = { ...proposed, x, y };
      const testReport = detectConflicts(testEl, existing);
      if (!testReport.hasConflict) {
        return { x, y, hasConflict: false };
      }
    }
  }

  // No free position found; return suggested position from first conflict
  const firstConflict = report.conflicts[0];
  return {
    x: firstConflict.suggestedPosition?.x ?? proposed.x,
    y: firstConflict.suggestedPosition?.y ?? proposed.y,
    hasConflict: true,
  };
}
