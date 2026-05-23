#!/usr/bin/env python3
"""
Apply AI-generated content to a template PPTX file (v4).

Uses placeholder semantics + spatial heuristics for precise layout:
  - CENTER_TITLE → main title (cover only)
  - Spatial order (top-to-bottom) determines title vs body on content slides
  - Filters out tiny decorative shapes and attribution/credit text

Strategy:
  - Cover: top CENTER_TITLE = title, bottom-most large SUBTITLE = subtitle
  - Content: top-most substantial shape = title, rest below = body lines
  - End: top-most substantial TITLE/CENTER_TITLE = main message
  - Unused slides are removed
"""

import json
import sys
import shutil
import re
from pptx import Presentation

# Minimum shape area (in square EMU) to be considered a content-bearing shape.
MIN_SHAPE_AREA = 250_000_000

# Regex to filter out attribution / credit text boxes
ATTRIBUTION_RE = re.compile(r'(freepik|slidesgo|addyouremail|company\.com|@freepik|please keep this slide|keep this slide for attribution|do you have any questions)', re.IGNORECASE)


def get_max_font(shape):
    if not shape.has_text_frame:
        return 0
    max_font = 0
    for p in shape.text_frame.paragraphs:
        for r in p.runs:
            if r.font.size and r.font.size > max_font:
                max_font = r.font.size
    return max_font


def get_shape_name(shape):
    """Extract shape name from XML (cNvPr name attribute)."""
    try:
        nvSpPr = shape._element.find('.//{http://schemas.openxmlformats.org/presentationml/2006/main}nvSpPr')
        if nvSpPr is not None:
            cNvPr = nvSpPr.find('{http://schemas.openxmlformats.org/presentationml/2006/main}cNvPr')
            if cNvPr is not None:
                return cNvPr.get('name', '')
    except Exception:
        pass
    return ''


def get_placeholder_type(shape):
    """Return placeholder type string, falling back to shape name for plain textboxes."""
    try:
        if hasattr(shape, 'placeholder_format') and shape.placeholder_format:
            return str(shape.placeholder_format.type)
    except Exception:
        pass
    # Fallback: infer from shape name set by our template generator
    name = get_shape_name(shape)
    name_map = {
        'CENTER_TITLE': 'CENTER_TITLE (3)',
        'TITLE': 'TITLE (1)',
        'SUBTITLE': 'SUBTITLE (4)',
        'BODY': 'BODY (2)',
        'PICTURE': 'PICTURE (18)',
    }
    return name_map.get(name)


def clear_shape_text(shape):
    if not shape.has_text_frame:
        return
    shape.text_frame.text = ''


def set_shape_text(shape, text):
    """Set text on a shape, fully replacing all paragraphs and preserving font size."""
    if not shape.has_text_frame:
        return False
    tf = shape.text_frame

    # Capture original font size from first run
    orig_size = None
    for p in tf.paragraphs:
        for r in p.runs:
            if r.font.size:
                orig_size = r.font.size
                break
        if orig_size:
            break

    # Use tf.text = '...' which wipes ALL paragraphs and creates a fresh one
    tf.text = text

    # Restore font size if we captured one
    if orig_size and tf.paragraphs and tf.paragraphs[0].runs:
        tf.paragraphs[0].runs[0].font.size = orig_size

    tf.word_wrap = True
    return True


def is_attribution(shape):
    """Check if a shape contains attribution/credit text."""
    if not shape.has_text_frame:
        return False
    text = shape.text_frame.text
    return bool(ATTRIBUTION_RE.search(text))


def get_substantial_text_shapes(slide):
    """Return text shapes that are large enough and not attribution."""
    result = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        text = shape.text_frame.text.strip()
        if not text:
            continue
        if is_attribution(shape):
            continue
        area = shape.width * shape.height
        if area < MIN_SHAPE_AREA:
            continue
        result.append({
            'shape': shape,
            'ph_type': get_placeholder_type(shape),
            'top': shape.top,
            'left': shape.left,
            'font': get_max_font(shape),
            'area': area,
            'text': text,
        })
    return result


def apply_cover(slide, title, subtitle=""):
    """Cover: top-most CENTER_TITLE = title, bottom-most SUBTITLE = subtitle.
    Fallback: largest font = title, second largest = subtitle."""
    shapes = get_substantial_text_shapes(slide)

    # Title: top-most CENTER_TITLE (y smallest = highest on page)
    center_titles = [s for s in shapes if s['ph_type'] == 'CENTER_TITLE (3)']
    if center_titles:
        center_titles.sort(key=lambda x: x['top'])
        set_shape_text(center_titles[0]['shape'], title)
        shapes.remove(center_titles[0])
        for ct in center_titles[1:]:
            clear_shape_text(ct['shape'])
            if ct in shapes:
                shapes.remove(ct)
    else:
        # Fallback: largest font = title
        shapes.sort(key=lambda x: (x['font'], x['area']), reverse=True)
        if shapes:
            set_shape_text(shapes[0]['shape'], title)
            shapes.remove(shapes[0])

    # Subtitle: bottom-most SUBTITLE (largest y)
    subtitles = [s for s in shapes if s['ph_type'] == 'SUBTITLE (4)']
    if subtitles and subtitle:
        subtitles.sort(key=lambda x: x['top'], reverse=True)
        set_shape_text(subtitles[0]['shape'], subtitle)
        shapes.remove(subtitles[0])
    elif shapes and subtitle:
        # Fallback: second largest font = subtitle
        shapes.sort(key=lambda x: (x['font'], x['area']), reverse=True)
        set_shape_text(shapes[0]['shape'], subtitle)
        shapes.remove(shapes[0])

    for s in shapes:
        clear_shape_text(s['shape'])


def apply_content(slide, title, body_lines=None):
    shapes = get_substantial_text_shapes(slide)
    if not shapes:
        return

    # Prefer TITLE placeholder as title; fall back to largest font shape
    title_candidates = [s for s in shapes if s['ph_type'] in ('TITLE (1)', 'CENTER_TITLE (3)')]
    if title_candidates:
        title_candidates.sort(key=lambda x: x['top'])
        title_shape = title_candidates[0]
    else:
        # Fallback: largest font = title (WPS templates use plain textboxes)
        shapes.sort(key=lambda x: (x['font'], x['area']), reverse=True)
        title_shape = shapes[0]

    set_shape_text(title_shape['shape'], title)
    shapes.remove(title_shape)

    # Body = remaining shapes, top-to-bottom (by Y coordinate)
    shapes.sort(key=lambda x: x['top'])
    body_shapes = shapes
    if body_lines and body_shapes:
        lines = list(body_lines)
        while len(lines) > len(body_shapes):
            lines[-2] = lines[-2] + '\n' + lines[-1]
            lines.pop()
        for i, line in enumerate(lines):
            set_shape_text(body_shapes[i]['shape'], line)
        for s in body_shapes[len(lines):]:
            clear_shape_text(s['shape'])
    else:
        for s in body_shapes:
            clear_shape_text(s['shape'])


def apply_end(slide, key_points=None):
    shapes = get_substantial_text_shapes(slide)
    if not shapes:
        return

    # Prefer TITLE/CENTER_TITLE for end slide main message
    title_candidates = [s for s in shapes if s['ph_type'] in ('TITLE (1)', 'CENTER_TITLE (3)')]
    if title_candidates:
        title_candidates.sort(key=lambda x: x['top'])
        main = title_candidates[0]
    else:
        # Fallback: largest font = main message (WPS templates)
        shapes.sort(key=lambda x: (x['font'], x['area']), reverse=True)
        main = shapes[0]

    main_shape = main['shape']
    if key_points:
        text = "\n".join(key_points)
        set_shape_text(main_shape, text)

    shapes.remove(main)
    for s in shapes:
        clear_shape_text(s['shape'])

    for shape in slide.shapes:
        if shape == main_shape:
            continue
        if is_attribution(shape):
            clear_shape_text(shape)


def is_toc_or_grid(slide):
    """Heuristic: slide with many numbered items is a TOC or grid.
    Exclude steps/quiz slides which have PICTURE placeholders for step numbers."""
    shapes = get_substantial_text_shapes(slide)
    # Steps/quiz slides have PICTURE placeholders — they are not TOC
    has_picture = any(s['ph_type'] == 'PICTURE (18)' for s in shapes)
    if has_picture:
        return False
    if len(shapes) > 10:
        return True
    number_count = 0
    for s in shapes:
        txt = s['text']
        if len(txt) <= 3 and txt.isdigit():
            number_count += 1
    return number_count >= 5


def count_body_placeholders(slide):
    shapes = get_substantial_text_shapes(slide)
    body_phs = sum(1 for s in shapes if s['ph_type'] in ('SUBTITLE (4)', 'BODY (2)'))
    if body_phs > 0:
        return body_phs
    # Fallback for WPS templates without standard placeholders:
    # all substantial text shapes except the title candidate count as body
    if len(shapes) >= 2:
        return len(shapes) - 1
    return 0


def count_title_placeholders(slide):
    shapes = get_substantial_text_shapes(slide)
    title_phs = sum(1 for s in shapes if s['ph_type'] in ('TITLE (1)', 'CENTER_TITLE (3)'))
    if title_phs > 0:
        return title_phs
    # Fallback for WPS templates: at least 1 title if there are text shapes
    return 1 if len(shapes) >= 1 else 0


def find_suitable_slides(prs):
    cover_idx = 0
    end_idx = len(prs.slides) - 1

    for i in range(len(prs.slides) - 1, -1, -1):
        has_text = any(s.has_text_frame and s.text_frame.text.strip() for s in prs.slides[i].shapes)
        if has_text:
            end_idx = i
            break

    candidates = []
    for i in range(cover_idx + 1, end_idx):
        shapes = get_substantial_text_shapes(prs.slides[i])
        # 2–12 shapes: enough for title+body, allow rich layouts like steps/process
        if 2 <= len(shapes) <= 12 and not is_toc_or_grid(prs.slides[i]):
            title_count = count_title_placeholders(prs.slides[i])
            body_count = count_body_placeholders(prs.slides[i])
            # Allow slides with CENTER_TITLE+TITLE (big-idea/highlight pages)
            # Reject only if zero titles or zero body
            if title_count == 0 or body_count < 1:
                continue
            candidates.append((i, body_count, len(shapes)))

    # Prefer slides with more body placeholders (better for multi-line content)
    candidates.sort(key=lambda x: (x[1], x[2]), reverse=True)
    content_indices = [c[0] for c in candidates]

    return cover_idx, content_indices, end_idx


def delete_slides(prs, keep_indices):
    keep_set = set(keep_indices)
    for i in range(len(prs.slides) - 1, -1, -1):
        if i not in keep_set:
            del prs.slides._sldIdLst[i]


def main():
    if len(sys.argv) < 4:
        print("Usage: python apply-template-v4.py <template.pptx> <output.pptx> <slides.json>")
        sys.exit(1)

    template_path = sys.argv[1]
    output_path = sys.argv[2]
    slides_json_path = sys.argv[3]

    with open(slides_json_path, 'r', encoding='utf-8') as f:
        slides_data = json.load(f)

    shutil.copy(template_path, output_path)
    prs = Presentation(output_path)

    cover_idx, content_indices, end_idx = find_suitable_slides(prs)

    cover_data = next((s for s in slides_data if s.get('type') == 'cover'), None)
    if cover_data:
        apply_cover(prs.slides[cover_idx], cover_data.get('title', ''), cover_data.get('subtitle', ''))

    content_data = [s for s in slides_data if s.get('type') == 'content']
    for i, data in enumerate(content_data):
        if i < len(content_indices):
            slide = prs.slides[content_indices[i]]
            body = data.get('body', '') or data.get('bullets', [])
            if isinstance(body, str):
                body = [body]
            elif not isinstance(body, list):
                body = [str(body)]
            apply_content(slide, data.get('title', ''), body)

    end_data = next((s for s in slides_data if s.get('type') == 'end'), None)
    if end_data:
        apply_end(prs.slides[end_idx], end_data.get('keyPoints', []))

    used_indices = [cover_idx] + content_indices[:len(content_data)] + [end_idx]
    delete_slides(prs, used_indices)

    prs.save(output_path)
    print(f"Saved to {output_path}")
    print(f"Kept slides: {[i + 1 for i in used_indices]} (total {len(used_indices)} / {len(prs.slides)})")


if __name__ == '__main__':
    main()
