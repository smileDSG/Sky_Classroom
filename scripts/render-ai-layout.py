#!/usr/bin/env python3
"""
AI Layout Renderer for PPTX

Renders complete Slide[] JSON (with full element positions/styles) into a new PPTX
using python-pptx. This preserves AI-designed layouts (two-column, images,
highlights, step cards, etc.) instead of flattening them to {type, title, body[]}.

Usage:
    python render-ai-layout.py <slides.json> <output.pptx>

The slides.json must contain an object with:
    {
      "slides": [ /* full Slide objects */ ],
      "theme": { /* optional ThemeToken */ }
    }
"""

import json
import sys
import os
import re
import base64
import urllib.request
import urllib.error
import tempfile
from typing import Any, Dict, List, Optional, Tuple

from pptx import Presentation
from pptx.util import Emu, Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.oxml.ns import qn
from lxml import etree

# ── Constants ──────────────────────────────────────────────────────

SLIDE_WIDTH_IN = 13.333   # 16:9 widescreen
SLIDE_HEIGHT_IN = 7.5
EMU_PER_INCH = 914400
DEFAULT_VIEWPORT_SIZE = 960

# Design-pixel to EMU: value * 10 * EMU_PER_INCH / viewport_size
# Simplified: value * 9144000 / viewport_size

# ── Logging ────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[render-ai-layout] {msg}", flush=True)

# ── Color Helpers ──────────────────────────────────────────────────

def parse_color(color_str: str) -> Optional[Tuple[int, int, int]]:
    """Parse hex color (#RRGGBB or #RGB or #RRGGBBAA) to RGB tuple."""
    if not color_str:
        return None
    color_str = color_str.strip()
    if color_str.startswith('#'):
        color_str = color_str[1:]
    if len(color_str) == 3:
        color_str = ''.join(c * 2 for c in color_str)
    elif len(color_str) == 8:
        color_str = color_str[:6]  # Drop alpha
    if len(color_str) == 6:
        try:
            return (int(color_str[0:2], 16), int(color_str[2:4], 16), int(color_str[4:6], 16))
        except ValueError:
            pass
    return None


def set_shape_fill(shape, color_str: str, opacity: float = 1.0) -> None:
    """Set solid fill on a shape with optional opacity."""
    rgb = parse_color(color_str)
    if not rgb:
        return
    fill = shape.fill
    fill.solid()
    fill.fore_color.rgb = RGBColor(*rgb)
    if opacity < 1.0:
        # Set alpha via lxml
        try:
            spPr = shape._element.spPr
            solidFill = spPr.find(qn('a:solidFill'))
            if solidFill is not None:
                srgbClr = solidFill.find(qn('a:srgbClr'))
                if srgbClr is not None:
                    alpha = etree.SubElement(srgbClr, qn('a:alpha'))
                    alpha.set('val', str(int(opacity * 100000)))
        except Exception:
            pass


def set_shape_outline(shape, color_str: Optional[str], width: Optional[float]) -> None:
    """Set line/outline on a shape."""
    if not color_str:
        return
    rgb = parse_color(color_str)
    if not rgb:
        return
    line = shape.line
    line.color.rgb = RGBColor(*rgb)
    if width:
        line.width = Pt(width)


# ── Coordinate Conversion ──────────────────────────────────────────

def to_emu(value: float, viewport_size: int) -> int:
    """Convert design-pixel value to EMU."""
    return int(value * SLIDE_WIDTH_IN * EMU_PER_INCH / viewport_size)


def element_bounds(el: Dict[str, Any], viewport_size: int) -> Tuple[int, int, int, int]:
    """Returns (left, top, width, height) in EMU."""
    return (
        to_emu(el.get('left', 0), viewport_size),
        to_emu(el.get('top', 0), viewport_size),
        to_emu(el.get('width', 100), viewport_size),
        to_emu(el.get('height', 100), viewport_size),
    )


# ── Image Handling ─────────────────────────────────────────────────

def resolve_image(src: str, temp_dir: str) -> Optional[str]:
    """Download or decode image, return local file path."""
    if not src:
        return None

    # Base64 data URI
    if src.startswith('data:'):
        try:
            # data:image/png;base64,XXXX
            parts = src.split(',', 1)
            if len(parts) == 2:
                data = base64.b64decode(parts[1])
                ext = 'png'
                if 'jpeg' in parts[0] or 'jpg' in parts[0]:
                    ext = 'jpg'
                elif 'gif' in parts[0]:
                    ext = 'gif'
                path = os.path.join(temp_dir, f'img_{hash(src) & 0xFFFFFFFF}.{ext}')
                with open(path, 'wb') as f:
                    f.write(data)
                return path
        except Exception as e:
            log(f"Failed to decode base64 image: {e}")
            return None

    # HTTP URL
    if src.startswith('http://') or src.startswith('https://'):
        try:
            ext = 'png'
            if '.' in src.split('?')[0].split('/')[-1]:
                ext = src.split('?')[0].split('/')[-1].split('.')[-1].lower()
                if ext not in ('png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'):
                    ext = 'png'
            path = os.path.join(temp_dir, f'img_{hash(src) & 0xFFFFFFFF}.{ext}')
            req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                with open(path, 'wb') as f:
                    f.write(resp.read())
            return path
        except Exception as e:
            log(f"Failed to download image {src[:60]}: {e}")
            return None

    # Local path (relative to project root)
    if src.startswith('/'):
        # Try relative to cwd/public
        for base in [os.getcwd(), os.path.join(os.getcwd(), 'public')]:
            full = os.path.join(base, src.lstrip('/'))
            if os.path.exists(full):
                return full

    # Raw base64 without data URI prefix
    if re.match(r'^[A-Za-z0-9+/=]+$', src):
        try:
            data = base64.b64decode(src)
            path = os.path.join(temp_dir, f'img_{hash(src) & 0xFFFFFFFF}.png')
            with open(path, 'wb') as f:
                f.write(data)
            return path
        except Exception:
            pass

    return None


# ── HTML Text Parsing ──────────────────────────────────────────────

def parse_inline_style(style_str: str) -> Dict[str, str]:
    """Parse CSS style string into dict."""
    result: Dict[str, str] = {}
    if not style_str:
        return result
    for part in style_str.split(';'):
        if ':' in part:
            k, v = part.split(':', 1)
            result[k.strip()] = v.strip()
    return result


def parse_html_content(html: str) -> List[Dict[str, Any]]:
    """
    Parse simple HTML into a list of paragraphs.
    Each paragraph has {'text': str, 'align': str, 'runs': [{text, bold, color, size, font}]}.
    """
    paragraphs: List[Dict[str, Any]] = []

    if not html:
        return paragraphs

    # Normalize
    html = html.replace('\n', ' ')

    # Split by <p> tags
    p_pattern = re.compile(r'<p\b([^>]*)>(.*?)</p>', re.IGNORECASE | re.DOTALL)
    p_matches = list(p_pattern.finditer(html))

    if not p_matches:
        # No <p> tags — treat entire content as single paragraph
        p_matches = [None]

    for p_match in p_matches:
        if p_match is None:
            p_style = {}
            p_content = html
        else:
            p_attrs = p_match.group(1)
            p_content = p_match.group(2)
            p_style = {}
            style_m = re.search(r'style=["\']([^"\']+)["\']', p_attrs)
            if style_m:
                p_style = parse_inline_style(style_m.group(1))

        align = 'left'
        if 'text-align' in p_style:
            ta = p_style['text-align'].lower()
            if ta in ('center', 'right', 'justify'):
                align = ta

        # Extract runs from <span> and <strong>/<b>/<em>/<i> tags
        runs: List[Dict[str, Any]] = []
        remaining = p_content

        # Split by tags
        tag_pattern = re.compile(r'<(/?)(\w+)\b([^>]*)>', re.IGNORECASE)

        # Simple approach: walk through the content and build runs
        # We track current style as we encounter open/close tags
        run_stack: List[Dict[str, Any]] = [{'text': '', 'bold': False, 'color': None, 'size': None, 'font': None}]

        pos = 0
        while pos < len(remaining):
            m = tag_pattern.search(remaining, pos)
            if not m:
                # Add remaining text to current run
                run_stack[-1]['text'] += remaining[pos:]
                break

            # Add text before tag
            if m.start() > pos:
                run_stack[-1]['text'] += remaining[pos:m.start()]

            is_close = m.group(1) == '/'
            tag_name = m.group(2).lower()
            tag_attrs = m.group(3)

            if is_close:
                # Pop style if stack has more than one
                if len(run_stack) > 1:
                    # Save completed run if it has text
                    if run_stack[-1]['text']:
                        runs.append(run_stack[-1].copy())
                    run_stack.pop()
                    # Start new run with parent style (but empty text)
                    parent = run_stack[-1].copy()
                    parent['text'] = ''
                    run_stack[-1] = parent
            else:
                # Save current run if it has text
                if run_stack[-1]['text']:
                    runs.append(run_stack[-1].copy())
                # Push new style
                new_run = run_stack[-1].copy()
                new_run['text'] = ''

                if tag_name in ('strong', 'b'):
                    new_run['bold'] = True
                elif tag_name in ('em', 'i'):
                    new_run['italic'] = True  # type: ignore
                elif tag_name == 'span' or tag_name == 'font':
                    style_m = re.search(r'style=["\']([^"\']+)["\']', tag_attrs)
                    if style_m:
                        span_style = parse_inline_style(style_m.group(1))
                        if 'color' in span_style:
                            new_run['color'] = span_style['color']
                        if 'font-size' in span_style:
                            fs = span_style['font-size']
                            # Extract number from "32px" or "24pt"
                            num_match = re.search(r'(\d+)', fs)
                            if num_match:
                                new_run['size'] = int(num_match.group(1))
                        if 'font-family' in span_style:
                            new_run['font'] = span_style['font-family'].strip('"\'')
                    # Also handle color="..." and size="..." attributes
                    color_m = re.search(r'color=["\']#?([^"\']+)["\']', tag_attrs)
                    if color_m:
                        new_run['color'] = '#' + color_m.group(1)
                    size_m = re.search(r'size=["\'](\d+)["\']', tag_attrs)
                    if size_m:
                        new_run['size'] = int(size_m.group(1))
                    face_m = re.search(r'face=["\']([^"\']+)["\']', tag_attrs)
                    if face_m:
                        new_run['font'] = face_m.group(1)

                run_stack.append(new_run)

            pos = m.end()

        # Don't forget the last run
        if run_stack[-1]['text']:
            runs.append(run_stack[-1].copy())

        # Also handle <br> tags within the content by splitting runs
        final_runs: List[Dict[str, Any]] = []
        for run in runs:
            parts = run['text'].split('<br>')
            for i, part in enumerate(parts):
                if i > 0:
                    # Insert a line-break indicator run
                    final_runs.append({**run, 'text': '', 'linebreak': True})
                if part:
                    final_runs.append({**run, 'text': part.replace('&nbsp;', ' ')})

        # Clean up empty runs and strip
        cleaned_runs = []
        for run in final_runs:
            text = run.get('text', '').strip()
            if text or run.get('linebreak'):
                cleaned_runs.append({**run, 'text': text})

        if cleaned_runs:
            paragraphs.append({
                'align': align,
                'runs': cleaned_runs,
            })

    return paragraphs


# ── Shape Mapping ──────────────────────────────────────────────────

def detect_shape_type(path: str, view_box: str) -> Optional[str]:
    """Detect MSO_SHAPE type from SVG path. Returns None if can't map."""
    if not path:
        return None

    path_lower = path.lower()

    # Round rect: has arc commands or roundRect
    if ('roundRect' in path or
        re.search(r'a\s+[\d.]+\s+[\d.]+\s+0\s+0\s+1', path, re.I) or
        re.search(r'a\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1', path, re.I)):
        # Distinguish circle from roundRect
        vb_parts = view_box.split() if view_box else ['0','0','100','100']
        if len(vb_parts) >= 4:
            vb_w, vb_h = float(vb_parts[2]), float(vb_parts[3])
            if abs(vb_w - vb_h) < max(vb_w, vb_h) * 0.1:
                # Check if it's a circle path
                if re.search(r'm\s+[\d.]+\s+[\d.]+\s+a\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1', path, re.I):
                    return 'ellipse'
        return 'roundRect'

    # Ellipse/circle
    if re.search(r'a\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1', path, re.I):
        return 'ellipse'

    # Simple rectangle
    simple_rect = re.match(r'^m\s*0\s+[\d.]*\s*l\s+[\d.]+\s+[\d.]*\s*l\s+[\d.]+\s+[\d.]+\s*l\s+[\d.]*\s+[\d.]+\s*z?$',
                           path.strip().replace('  ', ' '), re.I)
    if simple_rect:
        return 'rect'

    # Triangle: 3 unique points
    points = extract_path_points(path)
    unique_pts = []
    seen = set()
    for p in points:
        key = (round(p[0]), round(p[1]))
        if key not in seen:
            seen.add(key)
            unique_pts.append(p)
    if len(unique_pts) == 3 or (len(unique_pts) == 4 and points[0] == points[-1]):
        return 'triangle'

    # Arrow (pointed head, 6-9 points)
    if len(unique_pts) >= 6 and len(unique_pts) <= 9:
        max_x = max(p[0] for p in unique_pts)
        tip_count = sum(1 for p in unique_pts if abs(p[0] - max_x) < 1)
        if tip_count >= 1:
            return 'arrow'

    # Default: rect
    if len(unique_pts) >= 3:
        return 'rect'

    return None


def extract_path_points(path: str) -> List[Tuple[float, float]]:
    """Extract coordinate points from SVG path."""
    points: List[Tuple[float, float]] = []
    cmd_re = re.compile(r'[MmLlHhVvCcSsQqTtAaZz][\s\d.,\-]*')
    matches = cmd_re.findall(path)

    cx, cy = 0.0, 0.0
    for match in matches:
        cmd = match[0]
        nums = [float(n) for n in re.findall(r'-?[\d.]+', match[1:])]

        if cmd in 'MmLl':
            for i in range(0, len(nums) - 1, 2):
                cx, cy = nums[i], nums[i + 1]
                points.append((cx, cy))
        elif cmd == 'H':
            cx = nums[0]
            points.append((cx, cy))
        elif cmd == 'V':
            cy = nums[0]
            points.append((cx, cy))
        elif cmd == 'C':
            if len(nums) >= 6:
                cx, cy = nums[-2], nums[-1]
                points.append((cx, cy))
        elif cmd == 'Q':
            if len(nums) >= 4:
                cx, cy = nums[-2], nums[-1]
                points.append((cx, cy))

    return points


SHAPE_TYPE_MAP = {
    'rect': MSO_SHAPE.RECTANGLE,
    'roundRect': MSO_SHAPE.ROUNDED_RECTANGLE,
    'ellipse': MSO_SHAPE.OVAL,
    'triangle': MSO_SHAPE.ISOSCELES_TRIANGLE,
    'arrow': MSO_SHAPE.RIGHT_ARROW,
    'chevron': MSO_SHAPE.CHEVRON,
    'cross': MSO_SHAPE.CROSS,
    'plus': MSO_SHAPE.CHART_PLUS,
    'donut': MSO_SHAPE.DONUT,
}


# ── Element Renderers ──────────────────────────────────────────────

def render_text_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render a text element."""
    left, top, width, height = element_bounds(el, viewport_size)

    # Create textbox
    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True

    # Default style from element
    default_color = el.get('defaultColor', theme.get('fontColor', '#333333'))
    default_font = el.get('defaultFontName', theme.get('fontName', 'SimHei'))
    default_size = 18  # Fallback size in pt

    # Parse HTML content into paragraphs and runs
    html = el.get('content', '')
    paragraphs = parse_html_content(html)

    if not paragraphs:
        # Fallback: plain text
        p = tf.paragraphs[0]
        p.text = re.sub(r'<[^>]+>', '', html).strip() or ''
        p.font.size = Pt(default_size)
        p.font.color.rgb = RGBColor(*parse_color(default_color)) if parse_color(default_color) else RGBColor(51, 51, 51)
        p.font.name = default_font
        p.alignment = PP_ALIGN.LEFT
        return

    for i, para_data in enumerate(paragraphs):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()

        # Alignment
        align_map = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER,
                     'right': PP_ALIGN.RIGHT, 'justify': PP_ALIGN.JUSTIFY}
        p.alignment = align_map.get(para_data.get('align', 'left'), PP_ALIGN.LEFT)

        # Line spacing
        line_height = el.get('lineHeight', 1.5)
        p.line_spacing = line_height

        # Space before paragraph
        para_space = el.get('paragraphSpace', 5)
        p.space_before = Pt(para_space / 4)  # Approximate

        runs = para_data.get('runs', [])
        if not runs:
            continue

        for run_data in runs:
            if run_data.get('linebreak'):
                p.add_run().text = '\n'
                continue

            text = run_data.get('text', '')
            if not text:
                continue

            run = p.add_run()
            run.text = text

            # Font size
            size = run_data.get('size')
            if size:
                run.font.size = Pt(size)
            else:
                run.font.size = Pt(default_size)

            # Color
            color = run_data.get('color') or default_color
            rgb = parse_color(color)
            if rgb:
                run.font.color.rgb = RGBColor(*rgb)

            # Font name
            font = run_data.get('font') or default_font
            if font:
                run.font.name = font

            # Bold/italic
            if run_data.get('bold'):
                run.font.bold = True
            if run_data.get('italic'):
                run.font.italic = True

    # Fill background if specified
    fill_color = el.get('fill')
    if fill_color:
        set_shape_fill(shape, fill_color, el.get('opacity', 1.0))


def render_shape_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render a shape element."""
    left, top, width, height = element_bounds(el, viewport_size)

    path = el.get('path', '')
    view_box = el.get('viewBox', '')

    shape_type_name = detect_shape_type(path, view_box)
    shape_type = SHAPE_TYPE_MAP.get(shape_type_name, MSO_SHAPE.RECTANGLE)

    shape = slide.shapes.add_shape(shape_type, left, top, width, height)

    # Remove default outline
    shape.line.fill.background()

    # Fill
    fill_color = el.get('fill', theme.get('themeColors', ['#4a90d9'])[0] if theme.get('themeColors') else '#4a90d9')
    if fill_color:
        set_shape_fill(shape, fill_color, el.get('opacity', 1.0))

    # Gradient fill (fallback to solid with first color)
    gradient = el.get('gradient')
    if gradient and gradient.get('colors'):
        first_color = gradient['colors'][0].get('color', fill_color)
        set_shape_fill(shape, first_color, el.get('opacity', 1.0))

    # Outline
    outline = el.get('outline')
    if outline:
        set_shape_outline(shape, outline.get('color'), outline.get('width'))

    # Rotation
    rotate = el.get('rotate', 0)
    if rotate:
        shape.rotation = rotate

    # Text inside shape
    shape_text = el.get('text')
    if shape_text and shape_text.get('content'):
        tf = shape.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = re.sub(r'<[^>]+>', '', shape_text['content']).strip()

        text_color = shape_text.get('defaultColor', theme.get('fontColor', '#333333'))
        rgb = parse_color(text_color)
        if rgb:
            p.font.color.rgb = RGBColor(*rgb)

        font_name = shape_text.get('defaultFontName', theme.get('fontName', 'SimHei'))
        if font_name:
            p.font.name = font_name

        # Vertical alignment
        align = shape_text.get('align', 'middle')
        if align == 'top':
            tf.paragraphs[0].space_before = Pt(4)
        elif align == 'bottom':
            pass  # Default


def render_image_element(slide, el: Dict[str, Any], viewport_size: int, temp_dir: str) -> None:
    """Render an image element."""
    left, top, width, height = element_bounds(el, viewport_size)

    src = el.get('src', '')
    img_path = resolve_image(src, temp_dir)

    if not img_path:
        # Render placeholder
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        set_shape_fill(shape, '#f0f0f0')
        set_shape_outline(shape, '#cccccc', 1)

        tf = shape.text_frame
        p = tf.paragraphs[0]
        p.text = '[图片]'
        p.alignment = PP_ALIGN.CENTER
        p.font.size = Pt(12)
        p.font.color.rgb = RGBColor(153, 153, 153)
        return

    try:
        slide.shapes.add_picture(img_path, left, top, width, height)
    except Exception as e:
        log(f"Failed to add picture: {e}")
        # Placeholder
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        set_shape_fill(shape, '#f0f0f0')


def render_line_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render a line element."""
    start = el.get('start', [0, 0])
    end = el.get('end', [100, 0])

    left = to_emu(min(start[0], end[0]), viewport_size)
    top = to_emu(min(start[1], end[1]), viewport_size)
    width = to_emu(abs(end[0] - start[0]), viewport_size)
    height = to_emu(abs(end[1] - start[1]), viewport_size)

    # Ensure minimum dimensions for connector
    if width < 1000:
        width = 1000
    if height < 1000:
        height = 1000

    color = el.get('color', theme.get('dividerColor', '#cccccc'))
    line_width = el.get('width', 2)
    style = el.get('style', 'solid')

    rgb = parse_color(color)
    if not rgb:
        rgb = (204, 204, 204)

    # Use a thin rectangle as line (python-pptx connectors are tricky)
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    set_shape_fill(shape, color)
    shape.line.fill.background()  # No outline

    # Dash style via line format
    if style == 'dashed':
        shape.line.dash_style = 2  # DASH
    elif style == 'dotted':
        shape.line.dash_style = 3  # DOT


def render_table_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render a table element."""
    left, top, width, height = element_bounds(el, viewport_size)

    data = el.get('data', [[]])
    if not data or not data[0]:
        return

    rows = len(data)
    cols = len(data[0])

    table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table

    # Column widths
    col_widths = el.get('colWidths', [1.0 / cols] * cols)
    total_width = sum(col_widths)
    for i, cw in enumerate(col_widths):
        table.columns[i].width = int(width * cw / total_width)

    # Cell min height
    cell_min_h = el.get('cellMinHeight', 30)

    for r_idx, row_data in enumerate(data):
        for c_idx, cell_data in enumerate(row_data):
            if c_idx >= cols:
                break
            cell = table.cell(r_idx, c_idx)

            text = cell_data.get('text', '') if isinstance(cell_data, dict) else str(cell_data)
            cell.text = text

            style = cell_data.get('style', {}) if isinstance(cell_data, dict) else {}

            # Cell style
            if style.get('bold'):
                cell.text_frame.paragraphs[0].font.bold = True
            if style.get('color'):
                rgb = parse_color(style['color'])
                if rgb:
                    cell.text_frame.paragraphs[0].font.color.rgb = RGBColor(*rgb)
            if style.get('fontsize'):
                fs = style['fontsize']
                num_match = re.search(r'(\d+)', str(fs))
                if num_match:
                    cell.text_frame.paragraphs[0].font.size = Pt(int(num_match.group(1)))
            if style.get('align'):
                align_map = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER,
                             'right': PP_ALIGN.RIGHT, 'justify': PP_ALIGN.JUSTIFY}
                cell.text_frame.paragraphs[0].alignment = align_map.get(style['align'], PP_ALIGN.LEFT)
            if style.get('backcolor'):
                rgb = parse_color(style['backcolor'])
                if rgb:
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = RGBColor(*rgb)

            # Merge cells
            colspan = cell_data.get('colspan', 1) if isinstance(cell_data, dict) else 1
            rowspan = cell_data.get('rowspan', 1) if isinstance(cell_data, dict) else 1
            if colspan > 1 or rowspan > 1:
                try:
                    end_r = min(r_idx + rowspan - 1, rows - 1)
                    end_c = min(c_idx + colspan - 1, cols - 1)
                    if end_r > r_idx or end_c > c_idx:
                        cell.merge(table.cell(end_r, end_c))
                except Exception:
                    pass

    # Table outline
    outline = el.get('outline', {})
    if outline.get('color'):
        rgb = parse_color(outline['color'])
        if rgb:
            for row in table.rows:
                for cell in row.cells:
                    cell.vertical_anchor = MSO_ANCHOR.MIDDLE


def render_chart_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render chart as a simplified table (chart support in python-pptx is limited)."""
    left, top, width, height = element_bounds(el, viewport_size)

    chart_data = el.get('data', {})
    labels = chart_data.get('labels', [])
    series = chart_data.get('series', [[]])

    # Create a summary text box
    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = f"[图表: {el.get('chartType', 'unknown')}]"
    p.font.size = Pt(14)
    p.font.bold = True

    # Add data as text
    for i, label in enumerate(labels):
        p = tf.add_paragraph()
        values = [str(s[i]) if i < len(s) else '' for s in series]
        p.text = f"{label}: {', '.join(values)}"
        p.font.size = Pt(11)

    # Background
    set_shape_fill(shape, '#f8f8f8')
    set_shape_outline(shape, '#dddddd', 1)


def render_latex_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render LaTeX as plain text (OMML not available in python-pptx)."""
    left, top, width, height = element_bounds(el, viewport_size)

    latex = el.get('latex', '')
    align = el.get('align', 'center')

    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True

    p = tf.paragraphs[0]
    p.text = latex
    p.font.size = Pt(theme.get('bodyFontSize', 16))
    p.font.name = theme.get('fontName', 'Cambria Math')

    align_map = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT}
    p.alignment = align_map.get(align, PP_ALIGN.CENTER)

    color = el.get('color', theme.get('bodyColor', '#333333'))
    rgb = parse_color(color)
    if rgb:
        p.font.color.rgb = RGBColor(*rgb)


def render_code_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    """Render code element as formatted text."""
    left, top, width, height = element_bounds(el, viewport_size)

    lines = el.get('lines', [])
    language = el.get('language', '')
    file_name = el.get('fileName', '')
    font_size = el.get('fontSize', 14)

    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True

    # Title
    if file_name:
        p = tf.paragraphs[0]
        p.text = f"// {file_name}"
        p.font.size = Pt(font_size - 2)
        p.font.color.rgb = RGBColor(128, 128, 128)
        p.font.italic = True

    # Code lines
    for line_data in lines:
        p = tf.add_paragraph()
        p.text = line_data.get('content', '')
        p.font.size = Pt(font_size)
        p.font.name = 'Consolas'
        p.space_after = Pt(0)
        p.space_before = Pt(0)
        p.line_spacing = 1.2

    # Background
    set_shape_fill(shape, '#f4f4f4')
    set_shape_outline(shape, '#e0e0e0', 1)


# ── Slide Background ───────────────────────────────────────────────

def _set_gradient_background(slide, gradient: Dict[str, Any]) -> None:
    """Set true gradient background via lxml."""
    colors = gradient.get('colors', [])
    if len(colors) < 2:
        # Fallback to solid
        if colors:
            rgb = parse_color(colors[0].get('color', '#ffffff'))
            if rgb:
                slide.background.fill.solid()
                slide.background.fill.fore_color.rgb = RGBColor(*rgb)
        return

    fill = slide.background.fill
    fill.background()  # Clear existing fill

    # Access slide spTree to add gradient
    try:
        bg = slide.background
        bgPr = bg._element.get_or_add_bgPr()
        # Remove existing solid fill if any
        for child in list(bgPr):
            bgPr.remove(child)

        gradFill = etree.SubElement(bgPr, qn('a:gradFill'))
        gradFill.set('rotWithShape', '1')

        gsLst = etree.SubElement(gradFill, qn('a:gsLst'))
        for gc in colors:
            pos = int(gc.get('pos', 0) * 100000)
            color_str = gc.get('color', '#ffffff')
            rgb = parse_color(color_str) or (255, 255, 255)
            gs = etree.SubElement(gsLst, qn('a:gs'))
            gs.set('pos', str(pos))
            srgbClr = etree.SubElement(gs, qn('a:srgbClr'))
            srgbClr.set('val', f'{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}')

        lin = etree.SubElement(gradFill, qn('a:lin'))
        angle = gradient.get('rotate', 0)
        # Convert degrees to 60000ths of a degree
        lin_angle = int((angle - 90) * 60000)  # PPTX angle: 0 = top-to-bottom
        lin.set('ang', str(lin_angle))
        lin.set('scaled', '0')

        # Tile rect (fill entire slide)
        etree.SubElement(gradFill, qn('a:tileRect'))
    except Exception as e:
        log(f"Gradient background failed: {e}, falling back to solid")
        if colors:
            rgb = parse_color(colors[0].get('color', '#ffffff'))
            if rgb:
                slide.background.fill.solid()
                slide.background.fill.fore_color.rgb = RGBColor(*rgb)


def _add_slide_decorations(slide, slide_type: str, theme: Dict[str, Any], viewport_size: int) -> None:
    """Add theme decorations to slide based on type."""
    scale = SLIDE_WIDTH_IN * EMU_PER_INCH / viewport_size
    theme_colors = theme.get('themeColors', ['#4a90d9', '#81c784', '#c8e6c9'])
    accent = theme_colors[0] if theme_colors else '#4a90d9'
    accent_light = theme_colors[2] if len(theme_colors) > 2 else '#c8e6c9'

    if slide_type == 'cover':
        # Bottom accent bar
        bar_h = int(0.15 * EMU_PER_INCH)
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Inches(SLIDE_HEIGHT_IN).emu - bar_h, Inches(SLIDE_WIDTH_IN).emu, bar_h)
        set_shape_fill(shape, accent)
        shape.line.fill.background()

        # Top-left decorative circle (subtle)
        circle_size = int(0.8 * EMU_PER_INCH)
        shape2 = slide.shapes.add_shape(MSO_SHAPE.OVAL, int(0.1 * EMU_PER_INCH), int(0.1 * EMU_PER_INCH), circle_size, circle_size)
        set_shape_fill(shape2, accent_light)
        shape2.line.fill.background()
        # Send to back
        try:
            spTree = slide.shapes._spTree
            sp = shape2._element
            spTree.remove(sp)
            spTree.insert(2, sp)
        except Exception:
            pass

        # Title underline bar
        line_w = int(2.5 * EMU_PER_INCH)
        line_h = int(0.06 * EMU_PER_INCH)
        line_y = int(3.8 * EMU_PER_INCH)
        line_shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, int(0.8 * EMU_PER_INCH), line_y, line_w, line_h)
        set_shape_fill(line_shape, accent)
        line_shape.line.fill.background()

    elif slide_type == 'end':
        # Center decoration
        circle_size = int(2.5 * EMU_PER_INCH)
        cx = int((SLIDE_WIDTH_IN / 2) * EMU_PER_INCH) - circle_size // 2
        cy = int(1.5 * EMU_PER_INCH)
        shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, cx, cy, circle_size, circle_size)
        set_shape_fill(shape, accent_light)
        shape.line.fill.background()
        try:
            spTree = slide.shapes._spTree
            sp = shape._element
            spTree.remove(sp)
            spTree.insert(2, sp)
        except Exception:
            pass

    elif slide_type == 'content':
        # Top accent bar
        bar_h = int(0.08 * EMU_PER_INCH)
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(SLIDE_WIDTH_IN).emu, bar_h)
        set_shape_fill(shape, accent)
        shape.line.fill.background()

        # Bottom thin line
        line_y = int((SLIDE_HEIGHT_IN - 0.15) * EMU_PER_INCH)
        line_shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, int(0.5 * EMU_PER_INCH), line_y, int((SLIDE_WIDTH_IN - 1) * EMU_PER_INCH), int(0.02 * EMU_PER_INCH))
        set_shape_fill(line_shape, '#e0e0e0')
        line_shape.line.fill.background()

        # Page number area
        pn_shape = slide.shapes.add_textbox(int(11.5 * EMU_PER_INCH), int(7.0 * EMU_PER_INCH), int(1.5 * EMU_PER_INCH), int(0.3 * EMU_PER_INCH))
        pn_tf = pn_shape.text_frame
        pn_p = pn_tf.paragraphs[0]
        pn_p.text = ' '
        pn_p.font.size = Pt(8)
        pn_p.font.color.rgb = RGBColor(153, 153, 153)
        pn_p.alignment = PP_ALIGN.RIGHT


def apply_slide_background(slide, background: Optional[Dict[str, Any]], theme: Dict[str, Any]) -> None:
    """Apply background to a slide."""
    if not background:
        # Use theme background
        bg_color = theme.get('backgroundColor', '#ffffff')
        slide.background.fill.solid()
        rgb = parse_color(bg_color)
        if rgb:
            slide.background.fill.fore_color.rgb = RGBColor(*rgb)
        return

    bg_type = background.get('type', 'solid')

    if bg_type == 'solid':
        color = background.get('color', theme.get('backgroundColor', '#ffffff'))
        slide.background.fill.solid()
        rgb = parse_color(color)
        if rgb:
            slide.background.fill.fore_color.rgb = RGBColor(*rgb)

    elif bg_type == 'gradient':
        gradient = background.get('gradient', {})
        _set_gradient_background(slide, gradient)

    elif bg_type == 'image':
        img_info = background.get('image', {})
        src = img_info.get('src', '')
        if src:
            # Image backgrounds are complex in python-pptx; fallback to solid
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = RGBColor(240, 240, 240)


# ── Main Renderer ──────────────────────────────────────────────────

def render_presentation(data: Dict[str, Any], output_path: str) -> None:
    """Render slides data to PPTX file."""
    slides_data = data.get('slides', [])
    theme = data.get('theme', {})

    if not slides_data:
        raise ValueError("No slides in data")

    # Create presentation (16:9 widescreen)
    prs = Presentation()
    prs.slide_width = Inches(SLIDE_WIDTH_IN)
    prs.slide_height = Inches(SLIDE_HEIGHT_IN)

    # Use blank layout
    blank_layout = prs.slide_layouts[6]  # Typically blank

    temp_dir = tempfile.mkdtemp(prefix='pptx-img-')

    try:
        for i, slide_data in enumerate(slides_data):
            slide = prs.slides.add_slide(blank_layout)

            viewport_size = slide_data.get('viewportSize', DEFAULT_VIEWPORT_SIZE)
            slide_theme = slide_data.get('theme', theme)

            # Background
            apply_slide_background(slide, slide_data.get('background'), slide_theme)

            # Theme decorations
            _add_slide_decorations(slide, slide_data.get('type', 'content'), slide_theme, viewport_size)

            # Elements
            elements = slide_data.get('elements', [])
            for el in elements:
                el_type = el.get('type', '')
                try:
                    if el_type == 'text':
                        render_text_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'shape':
                        render_shape_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'image':
                        render_image_element(slide, el, viewport_size, temp_dir)
                    elif el_type == 'line':
                        render_line_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'table':
                        render_table_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'chart':
                        render_chart_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'latex':
                        render_latex_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'code':
                        render_code_element(slide, el, viewport_size, slide_theme)
                    elif el_type in ('video', 'audio'):
                        # Skip video/audio
                        pass
                    else:
                        log(f"Unknown element type: {el_type}")
                except Exception as e:
                    log(f"Error rendering element {el.get('id', '?')} ({el_type}): {e}")

            log(f"Rendered slide {i + 1}/{len(slides_data)}")

        # Save
        prs.save(output_path)
        log(f"Saved PPTX: {output_path}")

    finally:
        # Cleanup temp images
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


# ── CLI Entry ──────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python render-ai-layout.py <slides.json> <output.pptx>", file=sys.stderr)
        sys.exit(1)

    json_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    render_presentation(data, output_path)
    print(json.dumps({"success": True, "output": output_path}))


if __name__ == '__main__':
    main()
