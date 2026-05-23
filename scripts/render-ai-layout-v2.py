#!/usr/bin/env python3
"""
AI Layout Renderer v2 — WPS Template Background + AI Foreground

Opens a WPS template PPTX, removes all text boxes (keeping decorations),
and renders AI-designed elements on top. This preserves the template's
beautiful backgrounds/illustrations while allowing AI-controlled layout.

Usage:
    python render-ai-layout-v2.py <slides.json> <template.pptx> <output.pptx>
"""

import json
import sys
import os
import re
import base64
import urllib.request
import tempfile
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

from pptx import Presentation
from pptx.util import Emu, Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_SHAPE_TYPE
from pptx.oxml.ns import qn
from lxml import etree

# ── Constants ──────────────────────────────────────────────────────

SLIDE_WIDTH_IN = 13.333
SLIDE_HEIGHT_IN = 7.5
EMU_PER_INCH = 914400
DEFAULT_VIEWPORT_SIZE = 960

# ── Logging ────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[render-ai-layout-v2] {msg}", flush=True)

# ── Color Helpers ──────────────────────────────────────────────────

def parse_color(color_str: str) -> Optional[Tuple[int, int, int]]:
    if not color_str:
        return None
    color_str = color_str.strip()
    if color_str.startswith('#'):
        color_str = color_str[1:]
    if len(color_str) == 3:
        color_str = ''.join(c * 2 for c in color_str)
    elif len(color_str) == 8:
        color_str = color_str[:6]
    if len(color_str) == 6:
        try:
            return (int(color_str[0:2], 16), int(color_str[2:4], 16), int(color_str[4:6], 16))
        except ValueError:
            pass
    return None


def set_shape_fill(shape, color_str: str, opacity: float = 1.0) -> None:
    rgb = parse_color(color_str)
    if not rgb:
        return
    fill = shape.fill
    fill.solid()
    fill.fore_color.rgb = RGBColor(*rgb)
    if opacity < 1.0:
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
    return int(value * SLIDE_WIDTH_IN * EMU_PER_INCH / viewport_size)


def element_bounds(el: Dict[str, Any], viewport_size: int) -> Tuple[int, int, int, int]:
    return (
        to_emu(el.get('left', 0), viewport_size),
        to_emu(el.get('top', 0), viewport_size),
        to_emu(el.get('width', 100), viewport_size),
        to_emu(el.get('height', 100), viewport_size),
    )


# ── Image Handling ─────────────────────────────────────────────────

def resolve_image(src: str, temp_dir: str) -> Optional[str]:
    if not src:
        return None
    if src.startswith('data:'):
        try:
            parts = src.split(',', 1)
            if len(parts) == 2:
                data = base64.b64decode(parts[1])
                ext = 'png'
                if 'jpeg' in parts[0] or 'jpg' in parts[0]:
                    ext = 'jpg'
                path = os.path.join(temp_dir, f'img_{hash(src) & 0xFFFFFFFF}.{ext}')
                with open(path, 'wb') as f:
                    f.write(data)
                return path
        except Exception as e:
            log(f"Failed to decode base64 image: {e}")
            return None

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

    if src.startswith('/'):
        for base in [os.getcwd(), os.path.join(os.getcwd(), 'public')]:
            full = os.path.join(base, src.lstrip('/'))
            if os.path.exists(full):
                return full

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
    result: Dict[str, str] = {}
    if not style_str:
        return result
    for part in style_str.split(';'):
        if ':' in part:
            k, v = part.split(':', 1)
            result[k.strip()] = v.strip()
    return result


def parse_html_content(html: str) -> List[Dict[str, Any]]:
    paragraphs: List[Dict[str, Any]] = []
    if not html:
        return paragraphs
    html = html.replace('\n', ' ')
    p_pattern = re.compile(r'<p\b([^>]*)>(.*?)</p>', re.IGNORECASE | re.DOTALL)
    p_matches = list(p_pattern.finditer(html))
    if not p_matches:
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

        runs: List[Dict[str, Any]] = []
        remaining = p_content
        tag_pattern = re.compile(r'<(/?)(\w+)\b([^>]*)>', re.IGNORECASE)
        run_stack: List[Dict[str, Any]] = [{'text': '', 'bold': False, 'color': None, 'size': None, 'font': None}]
        pos = 0
        while pos < len(remaining):
            m = tag_pattern.search(remaining, pos)
            if not m:
                run_stack[-1]['text'] += remaining[pos:]
                break
            if m.start() > pos:
                run_stack[-1]['text'] += remaining[pos:m.start()]
            is_close = m.group(1) == '/'
            tag_name = m.group(2).lower()
            tag_attrs = m.group(3)
            if is_close:
                if len(run_stack) > 1:
                    if run_stack[-1]['text']:
                        runs.append(run_stack[-1].copy())
                    run_stack.pop()
                    parent = run_stack[-1].copy()
                    parent['text'] = ''
                    run_stack[-1] = parent
            else:
                if run_stack[-1]['text']:
                    runs.append(run_stack[-1].copy())
                new_run = run_stack[-1].copy()
                new_run['text'] = ''
                if tag_name in ('strong', 'b'):
                    new_run['bold'] = True
                elif tag_name in ('em', 'i'):
                    new_run['italic'] = True
                elif tag_name == 'span' or tag_name == 'font':
                    style_m = re.search(r'style=["\']([^"\']+)["\']', tag_attrs)
                    if style_m:
                        span_style = parse_inline_style(style_m.group(1))
                        if 'color' in span_style:
                            new_run['color'] = span_style['color']
                        if 'font-size' in span_style:
                            fs = span_style['font-size']
                            num_match = re.search(r'(\d+)', fs)
                            if num_match:
                                new_run['size'] = int(num_match.group(1))
                        if 'font-family' in span_style:
                            new_run['font'] = span_style['font-family'].strip('"\'')
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
        if run_stack[-1]['text']:
            runs.append(run_stack[-1].copy())

        final_runs: List[Dict[str, Any]] = []
        for run in runs:
            parts = run['text'].split('<br>')
            for i, part in enumerate(parts):
                if i > 0:
                    final_runs.append({**run, 'text': '', 'linebreak': True})
                if part:
                    final_runs.append({**run, 'text': part.replace('&nbsp;', ' ')})

        cleaned_runs = []
        for run in final_runs:
            text = run.get('text', '').strip()
            if text or run.get('linebreak'):
                cleaned_runs.append({**run, 'text': text})

        if cleaned_runs:
            paragraphs.append({'align': align, 'runs': cleaned_runs})

    return paragraphs


# ── Shape Mapping ──────────────────────────────────────────────────

def detect_shape_type(path: str, view_box: str) -> Optional[str]:
    if not path:
        return None
    if ('roundRect' in path or
        re.search(r'a\s+[\d.]+\s+[\d.]+\s+0\s+0\s+1', path, re.I) or
        re.search(r'a\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1', path, re.I)):
        vb_parts = view_box.split() if view_box else ['0','0','100','100']
        if len(vb_parts) >= 4:
            vb_w, vb_h = float(vb_parts[2]), float(vb_parts[3])
            if abs(vb_w - vb_h) < max(vb_w, vb_h) * 0.1:
                if re.search(r'm\s+[\d.]+\s+[\d.]+\s+a\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1', path, re.I):
                    return 'ellipse'
        return 'roundRect'
    if re.search(r'a\s+[\d.]+\s+[\d.]+\s+0\s+1\s+1', path, re.I):
        return 'ellipse'
    simple_rect = re.match(r'^m\s*0\s+[\d.]*\s*l\s+[\d.]+\s+[\d.]*\s*l\s+[\d.]+\s+[\d.]+\s*l\s+[\d.]*\s+[\d.]+\s*z?$',
                           path.strip().replace('  ', ' '), re.I)
    if simple_rect:
        return 'rect'
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
    if len(unique_pts) >= 6 and len(unique_pts) <= 9:
        max_x = max(p[0] for p in unique_pts)
        tip_count = sum(1 for p in unique_pts if abs(p[0] - max_x) < 1)
        if tip_count >= 1:
            return 'arrow'
    if len(unique_pts) >= 3:
        return 'rect'
    return None


def extract_path_points(path: str) -> List[Tuple[float, float]]:
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

# ── Element Renderers (reused from v1) ─────────────────────────────

def render_text_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    left, top, width, height = element_bounds(el, viewport_size)
    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True
    default_color = el.get('defaultColor', theme.get('fontColor', '#333333'))
    default_font = el.get('defaultFontName', theme.get('fontName', 'SimHei'))
    default_size = 18
    html = el.get('content', '')
    paragraphs = parse_html_content(html)

    if not paragraphs:
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
        align_map = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER,
                     'right': PP_ALIGN.RIGHT, 'justify': PP_ALIGN.JUSTIFY}
        p.alignment = align_map.get(para_data.get('align', 'left'), PP_ALIGN.LEFT)
        p.line_spacing = el.get('lineHeight', 1.5)
        p.space_before = Pt(el.get('paragraphSpace', 5) / 4)
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
            size = run_data.get('size')
            if size:
                run.font.size = Pt(size)
            else:
                run.font.size = Pt(default_size)
            color = run_data.get('color') or default_color
            rgb = parse_color(color)
            if rgb:
                run.font.color.rgb = RGBColor(*rgb)
            font = run_data.get('font') or default_font
            if font:
                run.font.name = font
            if run_data.get('bold'):
                run.font.bold = True
            if run_data.get('italic'):
                run.font.italic = True

    fill_color = el.get('fill')
    if fill_color:
        set_shape_fill(shape, fill_color, el.get('opacity', 1.0))


def render_shape_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    left, top, width, height = element_bounds(el, viewport_size)
    path = el.get('path', '')
    view_box = el.get('viewBox', '')
    shape_type_name = detect_shape_type(path, view_box)
    shape_type = SHAPE_TYPE_MAP.get(shape_type_name, MSO_SHAPE.RECTANGLE)
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.line.fill.background()
    fill_color = el.get('fill', theme.get('themeColors', ['#4a90d9'])[0] if theme.get('themeColors') else '#4a90d9')
    if fill_color:
        set_shape_fill(shape, fill_color, el.get('opacity', 1.0))
    gradient = el.get('gradient')
    if gradient and gradient.get('colors'):
        first_color = gradient['colors'][0].get('color', fill_color)
        set_shape_fill(shape, first_color, el.get('opacity', 1.0))
    outline = el.get('outline')
    if outline:
        set_shape_outline(shape, outline.get('color'), outline.get('width'))
    rotate = el.get('rotate', 0)
    if rotate:
        shape.rotation = rotate
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


def render_image_element(slide, el: Dict[str, Any], viewport_size: int, temp_dir: str) -> None:
    left, top, width, height = element_bounds(el, viewport_size)
    src = el.get('src', '')
    img_path = resolve_image(src, temp_dir)
    if not img_path:
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
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
        set_shape_fill(shape, '#f0f0f0')


def render_line_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    start = el.get('start', [0, 0])
    end = el.get('end', [100, 0])
    left = to_emu(min(start[0], end[0]), viewport_size)
    top = to_emu(min(start[1], end[1]), viewport_size)
    width = to_emu(abs(end[0] - start[0]), viewport_size)
    height = to_emu(abs(end[1] - start[1]), viewport_size)
    if width < 1000:
        width = 1000
    if height < 1000:
        height = 1000
    color = el.get('color', theme.get('dividerColor', '#cccccc'))
    rgb = parse_color(color) or (204, 204, 204)
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    set_shape_fill(shape, color)
    shape.line.fill.background()
    style = el.get('style', 'solid')
    if style == 'dashed':
        shape.line.dash_style = 2
    elif style == 'dotted':
        shape.line.dash_style = 3


def render_table_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    left, top, width, height = element_bounds(el, viewport_size)
    data = el.get('data', [[]])
    if not data or not data[0]:
        return
    rows = len(data)
    cols = len(data[0])
    table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table
    col_widths = el.get('colWidths', [1.0 / cols] * cols)
    total_width = sum(col_widths)
    for i, cw in enumerate(col_widths):
        table.columns[i].width = int(width * cw / total_width)
    for r_idx, row_data in enumerate(data):
        for c_idx, cell_data in enumerate(row_data):
            if c_idx >= cols:
                break
            cell = table.cell(r_idx, c_idx)
            text = cell_data.get('text', '') if isinstance(cell_data, dict) else str(cell_data)
            cell.text = text
            style = cell_data.get('style', {}) if isinstance(cell_data, dict) else {}
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
    outline = el.get('outline', {})
    if outline.get('color'):
        for row in table.rows:
            for cell in row.cells:
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE


def render_chart_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
    left, top, width, height = element_bounds(el, viewport_size)
    chart_data = el.get('data', {})
    labels = chart_data.get('labels', [])
    series = chart_data.get('series', [[]])
    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = f"[图表: {el.get('chartType', 'unknown')}]"
    p.font.size = Pt(14)
    p.font.bold = True
    for i, label in enumerate(labels):
        p = tf.add_paragraph()
        values = [str(s[i]) if i < len(s) else '' for s in series]
        p.text = f"{label}: {', '.join(values)}"
        p.font.size = Pt(11)
    set_shape_fill(shape, '#f8f8f8')
    set_shape_outline(shape, '#dddddd', 1)


def render_latex_element(slide, el: Dict[str, Any], viewport_size: int, theme: Dict[str, Any]) -> None:
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
    left, top, width, height = element_bounds(el, viewport_size)
    lines = el.get('lines', [])
    file_name = el.get('fileName', '')
    font_size = el.get('fontSize', 14)
    shape = slide.shapes.add_textbox(left, top, width, height)
    tf = shape.text_frame
    tf.word_wrap = True
    if file_name:
        p = tf.paragraphs[0]
        p.text = f"// {file_name}"
        p.font.size = Pt(font_size - 2)
        p.font.color.rgb = RGBColor(128, 128, 128)
        p.font.italic = True
    for line_data in lines:
        p = tf.add_paragraph()
        p.text = line_data.get('content', '')
        p.font.size = Pt(font_size)
        p.font.name = 'Consolas'
        p.space_after = Pt(0)
        p.space_before = Pt(0)
        p.line_spacing = 1.2
    set_shape_fill(shape, '#f4f4f4')
    set_shape_outline(shape, '#e0e0e0', 1)


# ── Slide Helpers ──────────────────────────────────────────────────

def _should_remove_shape(shape) -> bool:
    """Determine if a shape is a text content shape (to be removed)."""
    shape_type = shape.shape_type

    # Keep decoration groups (may contain empty text frames)
    if shape_type == MSO_SHAPE_TYPE.GROUP:
        return False

    # Keep pictures (decorative images)
    if shape_type == MSO_SHAPE_TYPE.PICTURE:
        return False

    # Keep lines
    if shape_type == MSO_SHAPE_TYPE.LINE:
        return False

    # Remove shapes with actual text content
    if shape.has_text_frame:
        text = shape.text_frame.text.strip()
        if text:
            return True

    # Keep empty shapes (decorations without text)
    return False


def clear_slide_texts(slide) -> None:
    """Remove all text-containing shapes from a slide, keep decorations."""
    to_remove = []
    for shape in slide.shapes:
        if _should_remove_shape(shape):
            to_remove.append(shape)

    for shape in to_remove:
        try:
            sp = shape._element
            sp.getparent().remove(sp)
        except Exception as e:
            log(f"Warning: failed to remove shape: {e}")

    # Also clear any remaining text in shapes that weren't removed
    # (e.g. GROUP shapes that might have text in sub-shapes)
    for shape in slide.shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            try:
                for sub in shape.shapes:
                    if sub.has_text_frame and sub.text_frame.text.strip():
                        for para in sub.text_frame.paragraphs:
                            para.clear()
            except Exception:
                pass


def _get_max_shape_id(prs) -> int:
    """Get the maximum shape ID across all slides to avoid conflicts."""
    max_id = 0
    p_ns = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    for slide in prs.slides:
        cSld = slide._element.find(qn('p:cSld'))
        if cSld is not None:
            # Walk all descendants looking for cNvPr
            for elem in cSld.iter():
                if elem.tag == f'{{{p_ns}}}cNvPr':
                    try:
                        id_val = int(elem.get('id', '0'))
                        if id_val > max_id:
                            max_id = id_val
                    except ValueError:
                        pass
    return max_id


def _reassign_shape_ids(cSld_element, start_id: int) -> int:
    """Reassign unique IDs to all shapes in a cSld element. Returns next available ID."""
    p_ns = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    current_id = start_id
    for elem in cSld_element.iter():
        if elem.tag == f'{{{p_ns}}}cNvPr':
            current_id += 1
            elem.set('id', str(current_id))
    return current_id


def duplicate_slide(prs, source_index: int, next_id: int) -> Tuple[Any, int]:
    """Duplicate a slide from the presentation. Returns (new_slide, next_id)."""
    source_slide = prs.slides[source_index]
    source_element = source_slide._element

    # Create a new slide with the same layout
    slide_layout = source_slide.slide_layout
    new_slide = prs.slides.add_slide(slide_layout)
    new_element = new_slide._element

    # Remove the new slide's cSld
    new_cSld = new_element.find(qn('p:cSld'))
    if new_cSld is not None:
        new_element.remove(new_cSld)

    # Deep copy source cSld
    copied_cSld = deepcopy(source_element.cSld)

    # Reassign shape IDs
    next_id = _reassign_shape_ids(copied_cSld, next_id)

    # Add copied cSld to new slide
    new_element.append(copied_cSld)

    return new_slide, next_id


def delete_slide(prs, index: int) -> None:
    """Delete a slide by index."""
    try:
        rId = prs.slides._sldIdLst[index].rId
        prs.part.drop_rel(rId)
        del prs.slides._sldIdLst[index]
    except Exception as e:
        log(f"Warning: failed to delete slide {index}: {e}")


def get_slide_mapping(slides_data: List[Dict[str, Any]], template_count: int) -> List[int]:
    """Map each AI slide to a template slide index."""
    mapping = []
    content_indices = list(range(2, template_count - 1)) if template_count > 3 else [0]
    if not content_indices:
        content_indices = [0]
    content_ptr = 0

    for slide_data in slides_data:
        slide_type = slide_data.get('type', 'content')
        if slide_type == 'cover':
            mapping.append(0)
        elif slide_type == 'contents':
            mapping.append(1 if template_count > 1 else 0)
        elif slide_type == 'end':
            mapping.append(template_count - 1)
        else:
            idx = content_indices[content_ptr % len(content_indices)]
            mapping.append(idx)
            content_ptr += 1

    return mapping


def prepare_template(prs, slides_data: List[Dict[str, Any]]) -> List[int]:
    """Ensure template has enough slides. Returns mapping of AI index -> template index."""
    template_count = len(prs.slides)
    ai_count = len(slides_data)

    mapping = get_slide_mapping(slides_data, template_count)
    max_needed_index = max(mapping) if mapping else 0

    # Calculate how many of each template page we need
    needed_counts: Dict[int, int] = {}
    for idx in mapping:
        needed_counts[idx] = needed_counts.get(idx, 0) + 1

    # Current count per template index
    current_counts: Dict[int, int] = {}
    for idx in range(template_count):
        current_counts[idx] = 1

    # Duplicate slides as needed
    next_id = _get_max_shape_id(prs)
    new_mapping = []
    for ai_idx, template_idx in enumerate(mapping):
        if current_counts.get(template_idx, 0) > 0:
            # Use existing slide
            current_counts[template_idx] -= 1
            # Find the actual slide index for this template page
            # (accounting for previously duplicated slides)
            new_mapping.append(template_idx)
        else:
            # Need to duplicate
            dup_slide, next_id = duplicate_slide(prs, template_idx, next_id)
            new_mapping.append(len(prs.slides) - 1)

    # Now we need to ensure the mapping points to correct slide indices
    # after all duplications. Let's rebuild mapping based on actual slide count.
    # Actually, the simpler approach: duplicate all needed slides first,
    # then map sequentially.

    return new_mapping


# ── Main Renderer ──────────────────────────────────────────────────

def render_presentation(data: Dict[str, Any], template_path: str, output_path: str) -> None:
    slides_data = data.get('slides', [])
    theme = data.get('theme', {})

    if not slides_data:
        raise ValueError("No slides in data")

    if not os.path.exists(template_path):
        raise ValueError(f"Template not found: {template_path}")

    # Open template (work on a copy)
    tmpdir = tempfile.mkdtemp(prefix='pptx-tpl-')
    working_template = os.path.join(tmpdir, 'template_work.pptx')
    import shutil
    shutil.copy(template_path, working_template)

    prs = Presentation(working_template)
    template_count = len(prs.slides)
    log(f"Template has {template_count} slides, AI has {len(slides_data)} slides")

    # Build mapping: which template slide to use for each AI slide
    mapping = get_slide_mapping(slides_data, template_count)

    # Count how many times each template index is used
    usage_counts: Dict[int, int] = {}
    for idx in mapping:
        usage_counts[idx] = usage_counts.get(idx, 0) + 1

    # Duplicate template slides as needed
    next_id = _get_max_shape_id(prs)
    slide_pool: Dict[int, List[int]] = {}  # template_idx -> [actual_slide_indices]

    for template_idx in sorted(usage_counts.keys()):
        count = usage_counts[template_idx]
        pool = []
        # First use the original
        pool.append(template_idx)
        # Then duplicate as needed
        for _ in range(count - 1):
            dup_slide, next_id = duplicate_slide(prs, template_idx, next_id)
            pool.append(len(prs.slides) - 1)
        slide_pool[template_idx] = pool

    # Track which pool item to use next
    pool_pointers: Dict[int, int] = {k: 0 for k in slide_pool}

    # Process each AI slide
    temp_img_dir = tempfile.mkdtemp(prefix='pptx-img-')
    try:
        for i, slide_data in enumerate(slides_data):
            template_idx = mapping[i]
            actual_idx = slide_pool[template_idx][pool_pointers[template_idx]]
            pool_pointers[template_idx] += 1

            slide = prs.slides[actual_idx]
            viewport_size = slide_data.get('viewportSize', DEFAULT_VIEWPORT_SIZE)
            slide_theme = slide_data.get('theme', theme)

            # Clear template text boxes
            clear_slide_texts(slide)

            # Render AI elements
            elements = slide_data.get('elements', [])
            for el in elements:
                el_type = el.get('type', '')
                try:
                    if el_type == 'text':
                        render_text_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'shape':
                        render_shape_element(slide, el, viewport_size, slide_theme)
                    elif el_type == 'image':
                        render_image_element(slide, el, viewport_size, temp_img_dir)
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
                        pass
                    else:
                        log(f"Unknown element type: {el_type}")
                except Exception as e:
                    log(f"Error rendering element {el.get('id', '?')} ({el_type}): {e}")

            log(f"Rendered slide {i + 1}/{len(slides_data)} using template page {template_idx + 1}")

        # Delete unused template slides
        # Collect indices of slides we used
        used_indices = set()
        for template_idx in slide_pool:
            for actual_idx in slide_pool[template_idx]:
                used_indices.add(actual_idx)

        # Delete slides not in used_indices (in reverse order)
        all_indices = list(range(len(prs.slides)))
        for idx in reversed(all_indices):
            if idx not in used_indices:
                delete_slide(prs, idx)

        prs.save(output_path)
        log(f"Saved PPTX: {output_path}")

    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
            shutil.rmtree(temp_img_dir, ignore_errors=True)
        except Exception:
            pass


# ── CLI Entry ──────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python render-ai-layout-v2.py <slides.json> <template.pptx> <output.pptx>", file=sys.stderr)
        sys.exit(1)

    json_path = sys.argv[1]
    template_path = sys.argv[2]
    output_path = sys.argv[3]

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    render_presentation(data, template_path, output_path)
    print(json.dumps({"success": True, "output": output_path}))


if __name__ == '__main__':
    main()
