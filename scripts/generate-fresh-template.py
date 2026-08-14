"""
Generate a fresh, clean, nature-inspired PPTX template from scratch.
16 slides: cover + 13 content layouts + end
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor as RgbColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from lxml import etree
import os

OUTPUT = 'C:/Users/11486/Desktop/智眸无界-B-001/public/templates/source/清新-template.pptx'

# ═══════════════════════════════════════════════════════════════════
# 配色方案 — 清新自然
# ═══════════════════════════════════════════════════════════════════
PRIMARY_GREEN  = RgbColor(0x4C, 0xAF, 0x50)   # #4CAF50 清新绿
LIGHT_GREEN    = RgbColor(0x81, 0xC7, 0x84)   # #81C784 浅绿
VERY_LIGHT_GR  = RgbColor(0xE8, 0xF5, 0xE9)   # #E8F5E9 极浅绿
SKY_BLUE       = RgbColor(0x64, 0xB5, 0xF6)   # #64B5F6 天蓝
LIGHT_BG       = RgbColor(0xF0, 0xF9, 0xF4)   # #F0F9F4 浅绿背景
LIGHT_BLUE_BG  = RgbColor(0xE3, 0xF2, 0xFD)   # #E3F2FD 浅蓝背景
DARK_TEXT      = RgbColor(0x2D, 0x3B, 0x36)   # #2D3B36 深绿文字
WHITE          = RgbColor(0xFF, 0xFF, 0xFF)
AMBER          = RgbColor(0xFF, 0xC1, 0x07)   # #FFC107 强调琥珀
GRAY_TEXT      = RgbColor(0x61, 0x61, 0x61)   # #616161 灰色文字


def add_shape_bg(slide, shape_type, left, top, width, height, fill_color, opacity=1.0, line=False):
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if opacity < 1.0:
        spPr = shape._element.spPr
        solidFill = spPr.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}solidFill')
        if solidFill is not None:
            srgbClr = solidFill.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}srgbClr')
            if srgbClr is not None:
                alpha = etree.SubElement(srgbClr, '{http://schemas.openxmlformats.org/drawingml/2006/main}alpha')
                alpha.set('val', str(int(opacity * 100000)))
    if not line:
        shape.line.fill.background()
    # Send to back
    spTree = slide.shapes._spTree
    sp = shape._element
    spTree.remove(sp)
    spTree.insert(2, sp)
    return shape


def add_textbox(slide, name, left, top, width, height, font_size, bold=False, color=DARK_TEXT, align=PP_ALIGN.LEFT, text=None):
    PLACEHOLDER_TEXT = {
        'CENTER_TITLE': '课件标题',
        'TITLE': '内容标题',
        'SUBTITLE': '要点说明文字',
        'BODY': '正文内容区域，可以容纳多行详细说明文字',
        'PICTURE': '[图片占位]',
    }
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text if text is not None else PLACEHOLDER_TEXT.get(name, name)
    run.font.size = font_size
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = 'Microsoft YaHei'
    nvSpPr = txBox._element.find('.//{http://schemas.openxmlformats.org/presentationml/2006/main}nvSpPr')
    if nvSpPr is not None:
        cNvPr = nvSpPr.find('{http://schemas.openxmlformats.org/presentationml/2006/main}cNvPr')
        if cNvPr is not None:
            cNvPr.set('name', name)
    return txBox


def set_slide_bg(slide, color):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color


prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]

SW = Inches(13.333)
SH = Inches(7.5)

# ═══════════════════════════════════════════════════════════════════
# 0. COVER — 渐变背景 + 装饰
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, LIGHT_BG)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.15), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0.15), Inches(0.12), SH, PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(10.8), Inches(0.4), Inches(2.3), Inches(2.3), LIGHT_GREEN, opacity=0.35)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(0.8), Inches(5.3), Inches(1.6), Inches(1.6), LIGHT_GREEN, opacity=0.25)
add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.5), Inches(5.0), Inches(3.5), Inches(1.8), VERY_LIGHT_GR)
add_textbox(s, 'CENTER_TITLE', Inches(1.0), Inches(2.4), Inches(9.0), Inches(1.2), Pt(52), bold=True, color=PRIMARY_GREEN)
add_textbox(s, 'SUBTITLE', Inches(1.0), Inches(3.8), Inches(9.0), Inches(0.8), Pt(22), color=GRAY_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 1. TOC — 目录页
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.1), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.9), Inches(11.0), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.7), Inches(1.4), Inches(0.04), PRIMARY_GREEN)
for idx in range(4):
    y = Inches(2.2 + idx * 1.2)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), y, Inches(11.5), Inches(1.0), VERY_LIGHT_GR)
    add_shape_bg(s, MSO_SHAPE.OVAL, Inches(1.2), y + Inches(0.25), Inches(0.5), Inches(0.5), PRIMARY_GREEN)
    num = add_textbox(s, 'PICTURE', Inches(1.2), y + Inches(0.3), Inches(0.5), Inches(0.4), Pt(18), bold=True, color=WHITE, align=PP_ALIGN.CENTER, text=str(idx+1))
    add_textbox(s, 'SUBTITLE', Inches(2.0), y + Inches(0.15), Inches(9.8), Inches(0.7), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 2. OBJECTIVES — 学习目标
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.1), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.9), Inches(11.0), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.7), Inches(1.4), Inches(0.04), PRIMARY_GREEN)
for idx in range(4):
    y = Inches(2.2 + idx * 1.2)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), y, Inches(11.5), Inches(1.0), VERY_LIGHT_GR)
    add_shape_bg(s, MSO_SHAPE.OVAL, Inches(1.2), y + Inches(0.25), Inches(0.5), Inches(0.5), LIGHT_GREEN)
    check = add_textbox(s, 'PICTURE', Inches(1.2), y + Inches(0.3), Inches(0.5), Inches(0.4), Pt(20), bold=True, color=PRIMARY_GREEN, align=PP_ALIGN.CENTER, text='✓')
    add_textbox(s, 'SUBTITLE', Inches(2.0), y + Inches(0.15), Inches(9.8), Inches(0.7), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 3. SECTION — 章节过渡
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, LIGHT_BLUE_BG)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.15), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0.15), Inches(0.12), SH, PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(10.5), Inches(0.5), Inches(2.5), Inches(2.5), LIGHT_GREEN, opacity=0.3)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(1.0), Inches(5.0), Inches(1.5), Inches(1.5), LIGHT_GREEN, opacity=0.2)
add_textbox(s, 'CENTER_TITLE', Inches(1.0), Inches(2.5), Inches(11.0), Inches(1.2), Pt(56), bold=True, color=PRIMARY_GREEN, align=PP_ALIGN.CENTER)
add_textbox(s, 'SUBTITLE', Inches(1.0), Inches(4.0), Inches(11.0), Inches(0.8), Pt(22), color=GRAY_TEXT, align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════
# 4. CONTENT A — 标准内容页
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
add_textbox(s, 'BODY', Inches(0.9), Inches(2.0), Inches(11.5), Inches(4.8), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 5. CONTENT B — 标准内容页（第二套）
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
add_textbox(s, 'BODY', Inches(0.9), Inches(2.0), Inches(11.5), Inches(4.8), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 6. BULLETS A — 要点列表
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
for idx in range(4):
    y = Inches(2.1 + idx * 1.25)
    add_shape_bg(s, MSO_SHAPE.OVAL, Inches(0.9), y + Inches(0.18), Inches(0.2), Inches(0.2), PRIMARY_GREEN)
    add_textbox(s, 'SUBTITLE', Inches(1.3), y, Inches(10.8), Inches(1.0), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 7. BULLETS B — 要点列表（第二套）
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
for idx in range(4):
    y = Inches(2.1 + idx * 1.25)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), y, Inches(11.5), Inches(1.05), VERY_LIGHT_GR)
    add_shape_bg(s, MSO_SHAPE.OVAL, Inches(1.1), y + Inches(0.28), Inches(0.22), Inches(0.22), PRIMARY_GREEN)
    add_textbox(s, 'SUBTITLE', Inches(1.5), y + Inches(0.05), Inches(10.5), Inches(0.95), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 8. TWO-COLUMN — 双栏对比
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
add_textbox(s, 'SUBTITLE', Inches(0.9), Inches(2.1), Inches(5.3), Inches(4.5), Pt(17), color=DARK_TEXT)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(6.5), Inches(2.1), Inches(0.03), Inches(4.2), VERY_LIGHT_GR)
add_textbox(s, 'SUBTITLE', Inches(6.8), Inches(2.1), Inches(5.3), Inches(4.5), Pt(17), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 9. IMAGE + TEXT — 图文混排
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(2.1), Inches(5.2), Inches(4.3), VERY_LIGHT_GR)
add_textbox(s, 'PICTURE', Inches(0.9), Inches(4.0), Inches(5.2), Inches(0.5), Pt(14), color=LIGHT_GREEN, align=PP_ALIGN.CENTER)
add_textbox(s, 'BODY', Inches(6.5), Inches(2.1), Inches(6.0), Inches(4.5), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 10. HIGHLIGHT — 强调/大概念
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(4.0), SH, PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(0.5), Inches(2.8), Inches(3.0), Inches(2.0), LIGHT_GREEN, opacity=0.25)
add_textbox(s, 'CENTER_TITLE', Inches(0.3), Inches(2.6), Inches(3.4), Inches(1.5), Pt(64), bold=True, color=WHITE, align=PP_ALIGN.CENTER)
add_textbox(s, 'TITLE', Inches(4.5), Inches(1.8), Inches(8.0), Inches(0.9), Pt(36), bold=True, color=PRIMARY_GREEN)
add_textbox(s, 'BODY', Inches(4.5), Inches(2.9), Inches(8.0), Inches(3.5), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 11. STEPS — 步骤流程
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
for idx in range(3):
    x = Inches(0.9 + idx * 4.1)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(2.2), Inches(3.6), Inches(4.2), VERY_LIGHT_GR)
    add_shape_bg(s, MSO_SHAPE.OVAL, x + Inches(1.4), Inches(2.45), Inches(0.8), Inches(0.8), PRIMARY_GREEN)
    num = add_textbox(s, 'PICTURE', x + Inches(1.4), Inches(2.55), Inches(0.8), Inches(0.6), Pt(26), bold=True, color=WHITE, align=PP_ALIGN.CENTER, text=str(idx + 1))
    add_textbox(s, 'SUBTITLE', x + Inches(0.3), Inches(3.45), Inches(3.0), Inches(0.6), Pt(18), bold=True, color=PRIMARY_GREEN, align=PP_ALIGN.CENTER)
    add_textbox(s, 'SUBTITLE', x + Inches(0.3), Inches(4.2), Inches(3.0), Inches(1.9), Pt(15), color=GRAY_TEXT, align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════
# 12. TABLE — 表格/数据页
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(2.1), Inches(11.5), Inches(1.0), PRIMARY_GREEN)
add_textbox(s, 'SUBTITLE', Inches(1.0), Inches(2.2), Inches(11.0), Inches(0.8), Pt(18), bold=True, color=WHITE)
for idx in range(3):
    y = Inches(3.2 + idx * 1.2)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), y, Inches(11.5), Inches(1.05), VERY_LIGHT_GR)
    add_textbox(s, 'SUBTITLE', Inches(1.1), y + Inches(0.1), Inches(11.0), Inches(0.85), Pt(17), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 13. QUIZ — 课堂练习
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
# Question
add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(2.1), Inches(11.5), Inches(1.0), LIGHT_BLUE_BG)
add_textbox(s, 'SUBTITLE', Inches(1.1), Inches(2.25), Inches(11.0), Inches(0.75), Pt(18), bold=True, color=DARK_TEXT)
# Options A/B/C/D
letters = ['A', 'B', 'C', 'D']
for idx in range(4):
    y = Inches(3.3 + idx * 0.9)
    row = idx // 2
    col = idx % 2
    x = Inches(0.9 + col * 6.0)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, Inches(5.5), Inches(0.75), VERY_LIGHT_GR)
    add_shape_bg(s, MSO_SHAPE.OVAL, x + Inches(0.15), y + Inches(0.15), Inches(0.45), Inches(0.45), PRIMARY_GREEN if idx == 0 else LIGHT_GREEN)
    letter = add_textbox(s, 'PICTURE', x + Inches(0.15), y + Inches(0.2), Inches(0.45), Inches(0.4), Pt(16), bold=True, color=WHITE, align=PP_ALIGN.CENTER, text=letters[idx])
    add_textbox(s, 'SUBTITLE', x + Inches(0.7), y + Inches(0.05), Inches(4.6), Inches(0.65), Pt(16), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 14. SUMMARY — 总结回顾
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, WHITE)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.08), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.0), Inches(0.06), Inches(0.7), PRIMARY_GREEN)
add_textbox(s, 'TITLE', Inches(0.9), Inches(0.85), Inches(11.5), Inches(0.8), Pt(34), bold=True, color=PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.55), Inches(1.5), Inches(0.04), PRIMARY_GREEN)
for idx in range(4):
    y = Inches(2.1 + idx * 1.25)
    add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), y, Inches(11.5), Inches(1.05), VERY_LIGHT_GR)
    add_shape_bg(s, MSO_SHAPE.OVAL, Inches(1.1), y + Inches(0.28), Inches(0.22), Inches(0.22), PRIMARY_GREEN)
    add_textbox(s, 'SUBTITLE', Inches(1.5), y + Inches(0.05), Inches(10.5), Inches(0.95), Pt(18), color=DARK_TEXT)

# ═══════════════════════════════════════════════════════════════════
# 15. END — 结束页
# ═══════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(blank)
set_slide_bg(s, LIGHT_BG)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), SW, Inches(0.15), PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.RECTANGLE, Inches(0), Inches(0.15), Inches(0.12), SH, PRIMARY_GREEN)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(10.5), Inches(0.5), Inches(2.3), Inches(2.3), LIGHT_GREEN, opacity=0.3)
add_shape_bg(s, MSO_SHAPE.OVAL, Inches(1.0), Inches(5.2), Inches(1.6), Inches(1.6), LIGHT_GREEN, opacity=0.25)
add_shape_bg(s, MSO_SHAPE.ROUNDED_RECTANGLE, Inches(3.5), Inches(5.0), Inches(6.5), Inches(1.6), VERY_LIGHT_GR)
add_textbox(s, 'TITLE', Inches(1.0), Inches(2.2), Inches(11.0), Inches(1.0), Pt(44), bold=True, color=PRIMARY_GREEN, align=PP_ALIGN.CENTER)
add_textbox(s, 'BODY', Inches(1.0), Inches(3.4), Inches(11.0), Inches(2.8), Pt(18), color=GRAY_TEXT, align=PP_ALIGN.CENTER)

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
prs.save(OUTPUT)
print(f"Saved: {OUTPUT}")
print(f"Slides: {len(prs.slides)}")
