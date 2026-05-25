#!/usr/bin/env python3
"""
多段落bullet列表文本框填充
处理P4/P5的summary等多段落复杂文本框
"""
from pptx.util import Pt

BULLET_CHARS = {'\u2022', '\u25cf', '\u25a0', '\u25b2', '*', '-', '\u2605'}


def _is_bullet_line(text):
    """判断一行是否已以bullet符号开头"""
    stripped = text.lstrip()
    return any(stripped.startswith(c) for c in BULLET_CHARS)


def fill_bullet_textbox(shape, text_content, preserve_format=True):
    """
    用多行文本替换shape的文本框。
    
    策略：
    - 按 \n 分割为多行
    - 第一行作为标题段落（无bullet）
    - 后续行如果已以bullet符号开头则保留，否则自动添加 "• "
    
    Args:
        shape: python-pptx shape对象
        text_content: str, 可能包含\n的多行文本
        preserve_format: bool, 是否保留原始字体格式
    
    Returns:
        bool: 是否成功
    """
    if not shape.has_text_frame:
        return False
    
    tf = shape.text_frame
    if len(tf.paragraphs) == 0:
        return False
    
    # 提取原始格式（从第一个有效run）
    font_name = None
    font_size = None
    font_color = None
    bold = None
    
    if preserve_format:
        for para in tf.paragraphs:
            for run in para.runs:
                if run.text.strip():
                    font_name = run.font.name
                    font_size = run.font.size
                    if run.font.color.type:
                        font_color = run.font.color.rgb
                    bold = run.font.bold
                    break
            if font_size:
                break
    
    # 分割输入文本
    lines = [line.strip() for line in text_content.split('\n') if line.strip()]
    if not lines:
        return False
    
    # 清空所有段落并删除多余段落（只保留第一个）
    txBody = tf._txBody
    p_elems = txBody.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}p')
    # 保留第一个段落元素，删除其余的
    for p_elem in p_elems[1:]:
        txBody.remove(p_elem)
    # 清空第一个段落
    first_para = tf.paragraphs[0]
    first_para.clear()
    
    # 写标题（第一行）
    title_run = first_para.add_run()
    title_run.text = lines[0]
    if preserve_format:
        if font_name:
            title_run.font.name = font_name
        if font_size:
            title_run.font.size = font_size
        if font_color:
            title_run.font.color.rgb = font_color
        if bold is not None:
            title_run.font.bold = bold
    
    # 写bullet段落（后续行）
    for line in lines[1:]:
        if _is_bullet_line(line):
            bullet_text = line
        else:
            bullet_text = f"\u2022 {line}"
        
        p = tf.add_paragraph()
        p.level = 0
        run = p.add_run()
        run.text = bullet_text
        
        if preserve_format:
            if font_name:
                run.font.name = font_name
            if font_size:
                run.font.size = font_size
            if font_color:
                run.font.color.rgb = font_color
            if bold is not None:
                run.font.bold = bold
    
    return True


def fill_simple_summary(shape, text_content, preserve_format=True):
    """
    简单总结文本框填充（单段落，无bullet）。
    用于P6 summary等简单多run段落。
    """
    if not shape.has_text_frame:
        return False
    
    tf = shape.text_frame
    if len(tf.paragraphs) == 0:
        return False
    
    # 提取原始格式
    font_name = None
    font_size = None
    font_color = None
    bold = None
    
    if preserve_format:
        for para in tf.paragraphs:
            for run in para.runs:
                if run.text.strip():
                    font_name = run.font.name
                    font_size = run.font.size
                    if run.font.color.type:
                        font_color = run.font.color.rgb
                    bold = run.font.bold
                    break
            if font_size:
                break
    
    # 清空并写入
    first_para = tf.paragraphs[0]
    first_para.clear()
    run = first_para.add_run()
    run.text = text_content
    
    if preserve_format:
        if font_name:
            run.font.name = font_name
        if font_size:
            run.font.size = font_size
        if font_color:
            run.font.color.rgb = font_color
        if bold is not None:
            run.font.bold = bold
    
    return True
