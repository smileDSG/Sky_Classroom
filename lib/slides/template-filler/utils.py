#!/usr/bin/env python3
"""
工具函数：多run替换、页码更新、数字格式转换
"""


def replace_run_text(shape, para_idx, run_idx, new_text):
    """
    安全替换指定run的文本，保留其他run不变。
    用于处理多run单段落文本框（如 ☆ + text + ☆）。
    
    Args:
        shape: python-pptx shape对象
        para_idx: 段落索引
        run_idx: run索引
        new_text: 新文本
    
    Returns:
        bool: 是否成功
    """
    if not shape.has_text_frame:
        return False
    
    tf = shape.text_frame
    if para_idx >= len(tf.paragraphs):
        return False
    
    para = tf.paragraphs[para_idx]
    if run_idx >= len(para.runs):
        return False
    
    run = para.runs[run_idx]
    run.text = new_text
    return True


def update_page_numbers(prs, format_str="{current} / {total}"):
    """
    遍历所有幻灯片，更新页码文本。
    
    策略：查找包含 "数字 / 数字" 或 "数字/数字" 模式的文本框，
    替换为实际的页码。
    
    Args:
        prs: Presentation对象
        format_str: 页码格式，{current}和{total}为占位符
    
    Returns:
        int: 更新的页码数量
    """
    import re
    total = len(prs.slides)
    updated = 0
    
    page_pattern = re.compile(r'\d+\s*/\s*\d+')
    
    for idx, slide in enumerate(prs.slides):
        current = idx + 1
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text.strip()
                if page_pattern.match(text):
                    # 找到页码文本框
                    new_text = format_str.format(current=current, total=total)
                    # 清空并写入
                    tf = shape.text_frame
                    for para in tf.paragraphs:
                        para.clear()
                    first_para = tf.paragraphs[0]
                    run = first_para.add_run()
                    run.text = new_text
                    updated += 1
                    break
    
    return updated


# 数字转换表
_ARABIC_TO_CHINESE = {
    '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
    '01': '一', '02': '二', '03': '三', '04': '四',
    '05': '五', '06': '六', '07': '七', '08': '八',
    '09': '九', '10': '十',
}

_ARABIC_TO_CHINESE_CAPITAL = {
    '0': '零', '1': '壹', '2': '贰', '3': '叁', '4': '肆',
    '5': '伍', '6': '陆', '7': '柒', '8': '捌', '9': '玖',
    '01': '壹', '02': '贰', '03': '叁', '04': '肆',
    '05': '伍', '06': '陆', '07': '柒', '08': '捌',
    '09': '玖', '10': '拾',
}


def convert_number(num_str, style="chinese"):
    """
    将阿拉伯数字编号转换为指定风格。
    
    Args:
        num_str: str, 如 "01", "1", "3"
        style: str, "arabic" | "chinese" | "chinese-capital"
    
    Returns:
        str: 转换后的字符串
    """
    import re
    num_str = str(num_str).strip()
    
    # 空字符串直接返回
    if not num_str:
        return num_str
    
    # 尝试提取数字部分
    digits_only = re.sub(r'[^0-9]', '', num_str)
    if not digits_only:
        # 非数字输入，直接返回原值（如 "①"）
        return num_str
    
    if style == "arabic":
        # 去掉前导零
        return str(int(digits_only))
    
    if style == "chinese":
        return _ARABIC_TO_CHINESE.get(digits_only, num_str)
    
    if style == "chinese-capital":
        return _ARABIC_TO_CHINESE_CAPITAL.get(digits_only, num_str)
    
    return num_str


def convert_toc_numbers(content_json, style="chinese"):
    """
    转换目录中的编号为指定风格。
    
    Args:
        content_json: dict, JSON内容
        style: str, 转换风格
    
    Returns:
        dict: 修改后的JSON（原地修改）
    """
    if "toc" in content_json and "items" in content_json["toc"]:
        for item in content_json["toc"]["items"]:
            if "num" in item:
                item["num"] = convert_number(item["num"], style)
    
    if "chapter" in content_json and "num" in content_json["chapter"]:
        content_json["chapter"]["num"] = convert_number(
            content_json["chapter"]["num"], style
        )
    
    return content_json
