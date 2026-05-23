/**
 * PPTX Shape Mapper
 *
 * Maps SVG path strings and viewBox data to pptxgenjs native shape types.
 * Falls back to custGeom for complex paths.
 *
 * Architecture:
 *   - Detection layer: identify shape by path characteristics
 *   - Mapping layer: convert to pptxgenjs ShapeType + dimensions
 *   - Fallback layer: custGeom for unrecognized paths
 */

import type { PptxShapeMapping } from './types';

/** pptxgenjs built-in shape types we can map to */
type PptxShapeType =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'chevron'
  | 'pentagon'
  | 'hexagon'
  | 'cross'
  | 'plus'
  | 'donut'
  | 'custGeom';

interface ShapeMappingResult {
  shapeType: PptxShapeType;
  /** Native shapes may need adjustment to viewBox */
  adjustW?: number;
  adjustH?: number;
  /** For custGeom fallback */
  points?: Array<{ x: number; y: number }>;
}

// ── Detection Patterns ─────────────────────────────────────────────

const SHAPE_PATTERNS: Array<{
  name: PptxShapeType;
  test: (path: string, viewBox: [number, number], points?: Point[], unique?: Point[]) => boolean;
}> = [
  {
    name: 'roundRect',
    test: (path) =>
      /M\s*\d+\s+\d+\s+A\s+\d+\s+\d+/.test(path) ||
      /rx\s*=\s*["']\d+/.test(path) ||
      path.includes('roundRect') ||
      // Common round-rect path: M x y h w a r r 0 0 1 ...
      /M\s*[\d.]+\s+[\d.]+\s+h\s+[\d.]+\s+a\s+[\d.]+\s+[\d.]+/.test(path),
  },
  {
    name: 'ellipse',
    test: (path, vb) => {
      // Circle/ellipse path: M cx-r cy a r r 0 1 1 ...
      const ellipseRe =
        /M\s*[\d.]+\s+[\d.]+\s+A\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1/.test(path);
      const circleRe =
        /M\s*[\d.]+\s+[\d.]+\s+A\s+[\d.]+\s+[\d.]+\s+0\s+[\d.]+\s+[\d.]+/.test(
          path,
        );
      // Nearly square viewBox with circle path
      const isSquareish = Math.abs(vb[0] - vb[1]) < Math.max(vb[0], vb[1]) * 0.1;
      return (ellipseRe || circleRe) && isSquareish;
    },
  },
  {
    name: 'triangle',
    test: (_path, _vb, points, unique) => {
      if (!points || points.length < 3) return false;
      const u = unique || uniquePoints(points);
      return u.length === 3 || u.length === 4; // 4 with closing point
    },
  },
  {
    name: 'arrow',
    test: (_path, _vb, points, unique) => {
      if (!points) return false;
      const u = unique || uniquePoints(points);
      return u.length >= 6 && u.length <= 9 && hasPointedHead(u);
    },
  },
  {
    name: 'chevron',
    test: (_path, _vb, points, unique) => {
      if (!points) return false;
      const u = unique || uniquePoints(points);
      // Chevron: V-shape or > shape with 4-6 points
      return u.length >= 4 && u.length <= 6 && isChevronShape(u);
    },
  },
  {
    name: 'cross',
    test: (_path, _vb, points, unique) => {
      if (!points) return false;
      const u = unique || uniquePoints(points);
      // Cross has intersecting horizontal and vertical segments
      return u.length >= 8 && hasIntersectingAxes(u);
    },
  },
  {
    name: 'plus',
    test: (_path, _vb, points, unique) => {
      if (!points) return false;
      const u = unique || uniquePoints(points);
      // Plus is similar to cross but with filled arms
      return u.length >= 8 && hasIntersectingAxes(u);
    },
  },
  {
    name: 'donut',
    test: (path) => {
      // Donut has two concentric circles or a circle with hole
      return (
        path.includes('M') &&
        path.split('A').length >= 3 &&
        /M.*A.*A/.test(path)
      );
    },
  },
  {
    name: 'rect',
    test: (path, vb) => {
      // Simple rectangle: M 0 0 L w 0 L w h L 0 h Z
      const rectRe =
        /^M\s*0\s+[\d.]*\s*L\s*[\d.]+\s+[\d.]*\s*L\s*[\d.]+\s+[\d.]+\s*L\s*[\d.]*\s+[\d.]+\s*Z?$/i.test(
          path.trim().replace(/\s+/g, ' '),
        );
      return rectRe || (vb[0] > 0 && vb[1] > 0 && path.split(' ').length < 12);
    },
  },
];

// ── Public API ─────────────────────────────────────────────────────

/**
 * Map an SVG path to the best pptxgenjs native shape.
 * Returns null if the path is too complex and should use custGeom fallback.
 */
export function mapShapeToPptx(
  path: string,
  viewBox: string,
): PptxShapeMapping | null {
  if (!path || typeof viewBox !== 'string') return null;

  const vbParts = viewBox.split(/\s+/).map(Number);
  const vbW = vbParts[2] || 1;
  const vbH = vbParts[3] || 1;
  const vb: [number, number] = [vbW, vbH];

  // Pre-extract points once for geometric shape tests
  const extractedPoints = extractPoints(path);
  const uniquePts = uniquePoints(extractedPoints);

  for (const pattern of SHAPE_PATTERNS) {
    if (pattern.test(path, vb, extractedPoints, uniquePts)) {
      return {
        shapeType: pattern.name,
      };
    }
  }

  // Fallback: try to extract points for custGeom
  const points = extractPointsForCustGeom(path, vbW, vbH);
  if (points && points.length >= 3) {
    return {
      shapeType: 'custGeom',
      points,
    };
  }

  return null;
}

/**
 * Check if a shape can be mapped to a native pptxgenjs shape.
 * Used to decide between native shape (fast, editable) vs custGeom (slow).
 */
export function isNativeShape(path: string, viewBox: string): boolean {
  const result = mapShapeToPptx(path, viewBox);
  return result !== null && result.shapeType !== 'custGeom';
}

// ── Point Extraction (for custGeom fallback) ───────────────────────

function extractPointsForCustGeom(
  path: string,
  vbW: number,
  vbH: number,
): Array<{ x: number; y: number }> | null {
  try {
    const points = extractPoints(path);
    if (points.length < 3) return null;

    // Normalize to viewBox
    const unique = uniquePoints(points);
    return unique.map((p) => ({
      x: Math.round((p.x / vbW) * 100000),
      y: Math.round((p.y / vbH) * 100000),
    }));
  } catch {
    return null;
  }
}

// ── Internal Helpers ───────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

function extractPoints(path: string): Point[] {
  const points: Point[] = [];
  const cmdRe = /[MmLlHhVvCcSsQqTtAaZz][\s\d.,\-]*/g;
  const matches = path.match(cmdRe) || [];

  let currentX = 0;
  let currentY = 0;

  for (const match of matches) {
    const cmd = match[0];
    const nums = match
      .slice(1)
      .trim()
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);

    switch (cmd) {
      case 'M':
      case 'L': {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          currentX = nums[i];
          currentY = nums[i + 1];
          points.push({ x: currentX, y: currentY });
        }
        break;
      }
      case 'H': {
        currentX = nums[0];
        points.push({ x: currentX, y: currentY });
        break;
      }
      case 'V': {
        currentY = nums[0];
        points.push({ x: currentX, y: currentY });
        break;
      }
      case 'Z':
      case 'z': {
        // Close path — don't add duplicate
        break;
      }
      // For curves, approximate with end point
      case 'C': {
        if (nums.length >= 6) {
          currentX = nums[nums.length - 2];
          currentY = nums[nums.length - 1];
          points.push({ x: currentX, y: currentY });
        }
        break;
      }
      case 'Q': {
        if (nums.length >= 4) {
          currentX = nums[nums.length - 2];
          currentY = nums[nums.length - 1];
          points.push({ x: currentX, y: currentY });
        }
        break;
      }
    }
  }

  return points;
}

function uniquePoints(points: Point[]): Point[] {
  const seen = new Set<string>();
  const result: Point[] = [];
  for (const p of points) {
    const key = `${Math.round(p.x)},${Math.round(p.y)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

function hasPointedHead(points: Point[]): boolean {
  if (points.length < 3) return false;
  // Find the point with max x (tip of arrow)
  const maxX = Math.max(...points.map((p) => p.x));
  const tipPoints = points.filter((p) => Math.abs(p.x - maxX) < 1);
  return tipPoints.length >= 1;
}

function isChevronShape(points: Point[]): boolean {
  if (points.length < 4) return false;
  // Chevron should have a V or > shape
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);
  return xRange > yRange * 0.5;
}

function hasIntersectingAxes(points: Point[]): boolean {
  if (points.length < 8) return false;
  // Cross/plus should have points distributed in 4 quadrants around center
  const centerX =
    points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const centerY =
    points.reduce((sum, p) => sum + p.y, 0) / points.length;

  let quadrants = 0;
  if (points.some((p) => p.x > centerX && p.y < centerY)) quadrants++;
  if (points.some((p) => p.x > centerX && p.y > centerY)) quadrants++;
  if (points.some((p) => p.x < centerX && p.y > centerY)) quadrants++;
  if (points.some((p) => p.x < centerX && p.y < centerY)) quadrants++;

  return quadrants >= 3;
}

// ── Shape Preset Library ───────────────────────────────────────────

/**
 * Get a preset SVG path for a named shape.
 * Useful for templates that want to use consistent shapes.
 */
export function getShapePreset(name: PptxShapeType): { path: string; viewBox: string } | null {
  const presets: Record<string, { path: string; viewBox: string }> = {
    rect: {
      path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
      viewBox: '0 0 1 1',
    },
    roundRect: {
      path: 'M 8 0 L 92 0 A 8 8 0 0 1 100 8 L 100 92 A 8 8 0 0 1 92 100 L 8 100 A 8 8 0 0 1 0 92 L 0 8 A 8 8 0 0 1 8 0 Z',
      viewBox: '0 0 100 100',
    },
    ellipse: {
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z',
      viewBox: '0 0 100 100',
    },
    triangle: {
      path: 'M 50 0 L 100 100 L 0 100 Z',
      viewBox: '0 0 100 100',
    },
    arrow: {
      path: 'M 0 30 L 60 30 L 60 0 L 100 50 L 60 100 L 60 70 L 0 70 Z',
      viewBox: '0 0 100 100',
    },
    chevron: {
      path: 'M 20 0 L 60 50 L 20 100 L 0 100 L 40 50 L 0 0 Z',
      viewBox: '0 0 60 100',
    },
    cross: {
      path: 'M 40 0 L 60 0 L 60 40 L 100 40 L 100 60 L 60 60 L 60 100 L 40 100 L 40 60 L 0 60 L 0 40 L 40 40 Z',
      viewBox: '0 0 100 100',
    },
    plus: {
      path: 'M 40 0 L 60 0 L 60 40 L 100 40 L 100 60 L 60 60 L 60 100 L 40 100 L 40 60 L 0 60 L 0 40 L 40 40 Z',
      viewBox: '0 0 100 100',
    },
    donut: {
      path: 'M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 M 50 30 A 20 20 0 1 0 50 70 A 20 20 0 1 0 50 30 Z',
      viewBox: '0 0 100 100',
    },
  };
  return presets[name] || null;
}
