#!/usr/bin/env python3
"""
表格填充模块
处理P6表格页的cell内容替换
"""

from pptx.util import Pt


def _save_cell_style(cell):
    """保存单元格第一个 run 的样式（字体大小、颜色、粗体）"""
    for para in cell.text_frame.paragraphs:
        for run in para.runs:
            style = {
                "font_name": run.font.name,
                "font_size": run.font.size,
                "bold": run.font.bold,
                "color_type": run.font.color.type,
                "color_rgb": run.font.color.rgb if run.font.color.type else None,
            }
            return style
    return None


def _apply_cell_style(cell, style):
    """将保存的样式应用到单元格的所有 run"""
    if not style:
        return
    for para in cell.text_frame.paragraphs:
        for run in para.runs:
            if style.get("font_name"):
                run.font.name = style["font_name"]
            if style.get("font_size"):
                run.font.size = style["font_size"]
            if style.get("bold") is not None:
                run.font.bold = style["bold"]
            if style.get("color_type") and style.get("color_rgb"):
                run.font.color.rgb = style["color_rgb"]


def fill_table(shape, headers, rows, clear_excess=True):
    """
    填充表格内容。
    
    Args:
        shape: python-pptx shape对象（has_table=True）
        headers: list[str]，表头文本列表
        rows: list[list[str]]，数据行列表
        clear_excess: bool，是否清空多余行
    
    Returns:
        dict: 填充统计 {filled_rows, filled_cols, cleared_rows}
    """
    if not shape.has_table:
        return None
    
    table = shape.table
    num_rows = len(table.rows)
    num_cols = len(table.columns)
    
    stats = {"filled_rows": 0, "filled_cols": 0, "cleared_rows": 0}
    
    # 填充表头（第一行）
    header_row = table.rows[0]
    for c_idx in range(min(len(headers), num_cols)):
        cell = header_row.cells[c_idx]
        style = _save_cell_style(cell)
        cell.text = headers[c_idx]
        _apply_cell_style(cell, style)
        stats["filled_cols"] += 1
    
    # 清空未使用的表头cell
    for c_idx in range(len(headers), num_cols):
        cell = header_row.cells[c_idx]
        style = _save_cell_style(cell)
        cell.text = ""
        _apply_cell_style(cell, style)
    
    # 填充数据行（从第二行开始）
    data_start = 1
    available_data_rows = num_rows - 1  # 不含表头
    
    for r_idx in range(available_data_rows):
        row = table.rows[data_start + r_idx]
        if r_idx < len(rows):
            row_data = rows[r_idx]
            for c_idx in range(min(len(row_data), num_cols)):
                cell = row.cells[c_idx]
                style = _save_cell_style(cell)
                cell.text = row_data[c_idx]
                _apply_cell_style(cell, style)
            # 清空多余cell
            for c_idx in range(len(row_data), num_cols):
                cell = row.cells[c_idx]
                style = _save_cell_style(cell)
                cell.text = ""
                _apply_cell_style(cell, style)
            stats["filled_rows"] += 1
        elif clear_excess:
            # 清空多余行
            for c_idx in range(num_cols):
                cell = row.cells[c_idx]
                style = _save_cell_style(cell)
                cell.text = ""
                _apply_cell_style(cell, style)
            stats["cleared_rows"] += 1
    
    return stats


def inspect_table(shape):
    """检查表格结构，返回行列信息"""
    if not shape.has_table:
        return None
    
    table = shape.table
    result = {
        "rows": len(table.rows),
        "cols": len(table.columns),
        "content": []
    }
    
    for r_idx, row in enumerate(table.rows):
        cells = [cell.text for cell in row.cells]
        result["content"].append(cells)
    
    return result
