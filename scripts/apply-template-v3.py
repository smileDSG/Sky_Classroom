#!/usr/bin/env python3
"""
Apply AI-generated content to a template PPTX file (v3).

Smart matching:
  - Cover: largest font = title, 2nd largest = subtitle, clear others
  - Content: largest font = title, rest by Y-position = body, clear unused
  - End: largest font = main, clear others
  - Unused slides are removed
"""

import json
import sys
import shutil
from pptx import Presentation


def get_text_info(shape):
    if not shape.has_text_frame:
        return None
    text = shape.text_frame.text.strip()
    if not text:
        return None
    max_font = 0
    for p in shape.text_frame.paragraphs:
        for r in p.runs:
            if r.font.size and r.font.size > max_font:
                max_font = r.font.size
    return {
        'shape': shape,
        'text': text,
        'max_font': max_font,
        'top': shape.top,
    }


def clear_shape_text(shape):
    if not shape.has_text_frame:
        return
    for p in shape.text_frame.paragraphs:
        p.clear()


def set_shape_text(shape, text):
    if not shape.has_text_frame:
        return False
    tf = shape.text_frame
    if len(tf.paragraphs) == 0:
        return False
    p = tf.paragraphs[0]
    p.clear()
    run = p.add_run()
    run.text = text
    # Preserve font size from original first run if available
    for orig_p in tf.paragraphs:
        for orig_r in orig_p.runs:
            if orig_r.font.size:
                run.font.size = orig_r.font.size
                break
        break
    return True


def apply_cover(slide, title, subtitle=""):
    infos = [get_text_info(s) for s in slide.shapes]
    infos = [i for i in infos if i]
    infos.sort(key=lambda x: x['max_font'], reverse=True)

    if len(infos) > 0:
        set_shape_text(infos[0]['shape'], title)
    if len(infos) > 1 and subtitle:
        set_shape_text(infos[1]['shape'], subtitle)
    for info in infos[2:]:
        clear_shape_text(info['shape'])


def apply_content(slide, title, body_lines=None):
    infos = [get_text_info(s) for s in slide.shapes]
    infos = [i for i in infos if i]

    # Title = largest font
    infos.sort(key=lambda x: x['max_font'], reverse=True)
    title_info = infos[0] if infos else None
    body_infos = infos[1:] if len(infos) > 1 else []

    if title_info:
        set_shape_text(title_info['shape'], title)

    # Body = rest sorted by Y position
    body_infos.sort(key=lambda x: x['top'])

    if body_lines:
        for i, line in enumerate(body_lines):
            if i < len(body_infos):
                set_shape_text(body_infos[i]['shape'], line)
        # Clear unused body shapes
        for info in body_infos[len(body_lines):]:
            clear_shape_text(info['shape'])
    else:
        for info in body_infos:
            clear_shape_text(info['shape'])


def apply_end(slide, key_points=None):
    infos = [get_text_info(s) for s in slide.shapes]
    infos = [i for i in infos if i]
    infos.sort(key=lambda x: x['max_font'], reverse=True)

    if key_points and len(infos) > 0:
        text = "\n".join(key_points)
        set_shape_text(infos[0]['shape'], text)
    for info in infos[1:]:
        clear_shape_text(info['shape'])


def find_suitable_slides(prs):
    cover_idx = 0
    end_idx = len(prs.slides) - 1

    for i in range(len(prs.slides) - 1, -1, -1):
        has_text = any(s.has_text_frame and s.text_frame.text.strip() for s in prs.slides[i].shapes)
        if has_text:
            end_idx = i
            break

    content_indices = []
    for i in range(cover_idx + 1, end_idx):
        text_count = sum(1 for s in prs.slides[i].shapes if s.has_text_frame and s.text_frame.text.strip())
        if text_count >= 2:
            content_indices.append(i)

    return cover_idx, content_indices, end_idx


def delete_slides(prs, keep_indices):
    """Remove all slides except those in keep_indices (0-based)."""
    keep_set = set(keep_indices)
    # Delete from end to beginning to avoid index shifting
    for i in range(len(prs.slides) - 1, -1, -1):
        if i not in keep_set:
            # Get the slide ID
            slide_id = prs.slides._sldIdLst[i]
            # Remove from slide list
            prs.slides._sldIdLst.remove(slide_id)


def main():
    if len(sys.argv) < 4:
        print("Usage: python apply-template-v3.py <template.pptx> <output.pptx> <slides.json>")
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

    # Keep only used slides
    used_indices = [cover_idx] + content_indices[:len(content_data)] + [end_idx]
    delete_slides(prs, used_indices)

    prs.save(output_path)
    print(f"Saved to {output_path}")
    print(f"Kept slides: {[i + 1 for i in used_indices]} (total {len(used_indices)} / {len(prs.slides)})")


if __name__ == '__main__':
    main()
