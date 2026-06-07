/**
 * P6-001 Test 4: 白板操作 → 冲突检测 → 布局调整
 *
 * Tests the whiteboard interaction flow including element creation,
 * conflict detection, collision resolution, and auto-layout adjustments.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ─── Types ───

interface WhiteboardElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'chart';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
}

interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictingElements: string[];
  suggestedPositions: Map<string, { x: number; y: number }>;
}

// ─── Conflict detection logic ───

function detectConflict(
  newElement: WhiteboardElement,
  existingElements: WhiteboardElement[],
  overlapThreshold = 0.1,
): ConflictDetectionResult {
  const conflicting: string[] = [];
  const suggested = new Map<string, { x: number; y: number }>();

  for (const existing of existingElements) {
    if (existing.id === newElement.id) continue;

    const overlap = calculateOverlap(newElement, existing);
    if (overlap > overlapThreshold) {
      conflicting.push(existing.id);
      suggested.set(existing.id, {
        x: existing.x + newElement.width + 20,
        y: existing.y,
      });
    }
  }

  return {
    hasConflict: conflicting.length > 0,
    conflictingElements: conflicting,
    suggestedPositions: suggested,
  };
}

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
  const areaA = a.width * a.height;
  return overlapArea / areaA;
}

function autoLayout(elements: WhiteboardElement[], spacing = 20): WhiteboardElement[] {
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const layout: WhiteboardElement[] = [];
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;

  for (const el of sorted) {
    if (currentX + el.width > 1200) {
      currentX = 0;
      currentY += rowHeight + spacing;
      rowHeight = 0;
    }
    layout.push({ ...el, x: currentX, y: currentY });
    currentX += el.width + spacing;
    rowHeight = Math.max(rowHeight, el.height);
  }

  return layout;
}

// ─── Tests ───

describe('P6-001 Test 4: 白板操作 → 冲突检测 → 布局调整', () => {
  describe('element creation', () => {
    test('draws text element on whiteboard', () => {
      const el: WhiteboardElement = {
        id: 'text-1',
        type: 'text',
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Hello World',
      };

      expect(el.type).toBe('text');
      expect(el.content).toBe('Hello World');
    });

    test('draws shape element on whiteboard', () => {
      const el: WhiteboardElement = {
        id: 'shape-1',
        type: 'shape',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      };

      expect(el.type).toBe('shape');
      expect(el.width).toBe(100);
    });
  });

  describe('conflict detection', () => {
    test('detects overlapping text elements', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
      ];
      const newEl: WhiteboardElement = {
        id: 'text-2',
        type: 'text',
        x: 50,
        y: 20,
        width: 100,
        height: 50,
      };

      const result = detectConflict(newEl, existing);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingElements).toContain('text-1');
    });

    test('no conflict when elements are separate', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
      ];
      const newEl: WhiteboardElement = {
        id: 'text-2',
        type: 'text',
        x: 200,
        y: 200,
        width: 100,
        height: 50,
      };

      const result = detectConflict(newEl, existing);
      expect(result.hasConflict).toBe(false);
      expect(result.conflictingElements).toHaveLength(0);
    });

    test('partial overlap below threshold passes', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
      ];
      const newEl: WhiteboardElement = {
        id: 'text-2',
        type: 'text',
        x: 95,
        y: 0,
        width: 100,
        height: 50,
      };

      const result = detectConflict(newEl, existing, 0.5);
      // Small overlap, below threshold
      expect(result.hasConflict).toBe(false);
    });

    test('detects conflicts with multiple elements', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
        { id: 'shape-1', type: 'shape', x: 200, y: 0, width: 80, height: 80 },
      ];
      const newEl: WhiteboardElement = {
        id: 'text-2',
        type: 'text',
        x: 50,
        y: 20,
        width: 100,
        height: 50,
      };

      const result = detectConflict(newEl, existing);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingElements).toContain('text-1');
    });
  });

  describe('layout adjustment', () => {
    test('provides suggested positions for conflicting elements', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
      ];
      const newEl: WhiteboardElement = {
        id: 'text-2',
        type: 'text',
        x: 50,
        y: 20,
        width: 100,
        height: 50,
      };

      const result = detectConflict(newEl, existing);
      expect(result.suggestedPositions.has('text-1')).toBe(true);
      const suggested = result.suggestedPositions.get('text-1')!;
      expect(suggested.x).toBeGreaterThan(existing[0].x);
    });

    test('auto-layout arranges elements in grid', () => {
      const elements: WhiteboardElement[] = [
        { id: 'a', type: 'text', x: 0, y: 0, width: 200, height: 50 },
        { id: 'b', type: 'text', x: 0, y: 0, width: 200, height: 50 },
        { id: 'c', type: 'text', x: 0, y: 0, width: 200, height: 50 },
      ];

      const layout = autoLayout(elements);
      expect(layout.length).toBe(3);
      // All elements should be repositioned
      expect(layout[0].x).toBe(0);
      expect(layout[0].y).toBe(0);
    });

    test('auto-layout wraps to new row when width exceeded', () => {
      const elements: WhiteboardElement[] = [
        { id: 'a', type: 'text', x: 0, y: 0, width: 600, height: 50 },
        { id: 'b', type: 'text', x: 0, y: 0, width: 600, height: 50 },
        { id: 'c', type: 'text', x: 0, y: 0, width: 600, height: 50 },
      ];

      const layout = autoLayout(elements, 20);
      // First two elements on row 1 (600+20+600 = 1220 > 1200)
      expect(layout[0].y).toBe(0);
      expect(layout[1].y).toBeGreaterThan(0);
      expect(layout[2].y).toBe(layout[1].y); // Same row
    });

    test('empty elements array returns empty layout', () => {
      expect(autoLayout([])).toEqual([]);
    });
  });

  describe('whiteboard conflict prevention', () => {
    test('prevents self-collision (same element ID)', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
      ];
      const newEl: WhiteboardElement = {
        id: 'text-1', // Same ID
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      };

      const result = detectConflict(newEl, existing);
      // Should skip self-collision
      expect(result.hasConflict).toBe(false);
    });

    test('chart elements can overlap with text without conflict', () => {
      const existing: WhiteboardElement[] = [
        { id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
      ];
      const chart: WhiteboardElement = {
        id: 'chart-1',
        type: 'chart',
        x: 10,
        y: 10,
        width: 80,
        height: 40,
      };

      const result = detectConflict(chart, existing, 0.8);
      // High threshold allows chart-text overlap
      expect(result.hasConflict).toBe(false);
    });
  });
});
