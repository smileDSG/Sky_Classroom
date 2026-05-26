#!/usr/bin/env python3
"""
TemplateFiller - PPT模板填充引擎主类
"""
import json
import os
from pptx import Presentation
import bullet
import table
from utils import update_page_numbers, convert_toc_numbers


class TemplateFiller:
    """
    PPT模板填充引擎。
    
    Usage:
        filler = TemplateFiller("template.pptx", "mapping.json")
        filler.fill(content_json)
        filler.save("output.pptx")
    """
    
    def __init__(self, template_path, mapping_path):
        self.template_path = template_path
        self.mapping_path = mapping_path
        self.prs = Presentation(template_path)
        
        with open(mapping_path, "r", encoding="utf-8") as f:
            self.mapping = json.load(f)
        
        self.stats = {"total": 0, "filled": 0, "skipped": 0, "errors": []}
    
    def fill(self, content_json, number_style="arabic"):
        """
        将JSON内容填充到模板中。
        
        Args:
            content_json: dict, 统一Schema格式的内容
            number_style: str, 数字转换风格 (arabic|chinese|chinese-capital)
        """
        # 数字转换
        content_json = convert_toc_numbers(content_json.copy(), number_style)
        
        for slide_name, slide_mapping in self.mapping["mappings"].items():
            self._fill_slide(slide_name, slide_mapping, content_json)
        
        # 更新页码
        update_page_numbers(self.prs)
        
        return self.stats
    
    def _fill_slide(self, slide_name, slide_mapping, content_json):
        slide_idx = int(slide_name.replace("slide", "")) - 1
        if slide_idx >= len(self.prs.slides):
            self.stats["errors"].append(f"Slide {slide_idx+1} not found")
            return
        
        slide = self.prs.slides[slide_idx]
        
        # 处理普通字段
        for field_map in slide_mapping.get("fields", []):
            self.stats["total"] += 1
            shape_idx = field_map["shape_idx"]
            field_path = field_map["field"]
            
            if shape_idx >= len(slide.shapes):
                self.stats["skipped"] += 1
                self.stats["errors"].append(f"{slide_name} shape[{shape_idx}] out of range")
                continue
            
            shape = slide.shapes[shape_idx]
            value = self._get_json_value(content_json, field_path)
            
            # 字段不存在时用空字符串填充（避免显示原始模板内容）
            if value is None:
                value = ""
            
            if isinstance(value, str):
                original_text = field_map.get("original_text", "")
                max_chars = field_map.get("max_chars")
                success = self._fill_text(shape, value, original_text=original_text, max_chars=max_chars)
                if success:
                    self.stats["filled"] += 1
                else:
                    self.stats["skipped"] += 1
                    self.stats["errors"].append(f"Failed to fill {field_path}")
            else:
                self.stats["skipped"] += 1
        
        # 特殊处理：表格
        special = slide_mapping.get("special_handling", {})
        if "table" in special:
            self._handle_table(slide, special["table"], content_json)
        
        # 特殊处理：bullet列表
        if "bullet_list" in special:
            page_type = slide_mapping.get("page_type", "")
            preferred_key = page_type if page_type in ("content_a", "content_b", "table") else None
            self._handle_bullet(slide, special["bullet_list"], content_json, preferred_key)
        
        # 高度对齐：统一同 slide 中 cards[*].desc / cards[*].title 的 shape 高度
        self._align_shape_heights(slide, slide_mapping)
    
    def _align_shape_heights(self, slide, slide_mapping):
        """对齐同类 card shape 的高度，避免原始模板中个别框过小导致视觉不协调"""
        from collections import defaultdict
        
        # 按字段后缀分组（如 cards[0].desc, cards[1].desc -> 'cards.desc'）
        groups = defaultdict(list)
        for field_map in slide_mapping.get("fields", []):
            field = field_map.get("field", "")
            shape_idx = field_map.get("shape_idx")
            if shape_idx is None or shape_idx >= len(slide.shapes):
                continue
            # 提取分组键，例如 "content_a.cards[3].desc" -> "cards.desc"
            if ".cards[" in field and "]." in field:
                suffix = field.split("].")[-1]  # "desc" or "title"
                key = f"cards.{suffix}"
                groups[key].append(slide.shapes[shape_idx])
        
        for shapes in groups.values():
            if len(shapes) < 2:
                continue
            # 取最大高度作为标准
            max_height = max(s.height for s in shapes)
            for shape in shapes:
                if shape.height != max_height:
                    shape.height = max_height
    
    def _fill_text(self, shape, new_text, original_text=None, max_chars=None):
        """文本替换，支持多段落（用\\n\\n分隔），并自动缩小字体适配超长文本"""
        if not shape.has_text_frame:
            return False
        tf = shape.text_frame
        if len(tf.paragraphs) == 0:
            return False
        
        # 提取格式基准run：优先选第一个"有意义的run"（长度>1且不是纯装饰符号）
        # 避免把 ★☆• 等装饰符号的超大字体当作全段基准
        base_run = None
        first_para = tf.paragraphs[0]
        for para in tf.paragraphs:
            for run in para.runs:
                text = run.text.strip()
                if len(text) > 1 and not all(c in '★☆•·✦✧◆◇■□▲△●○✓✗☑☒' for c in text):
                    base_run = run
                    break
            if base_run:
                break
        # fallback 到第一段第一run
        if not base_run:
            base_run = first_para.runs[0] if first_para.runs else None
        
        font_name = base_run.font.name if base_run else None
        font_size = base_run.font.size if base_run else None
        font_color = base_run.font.color.rgb if base_run and base_run.font.color.type else None
        bold = base_run.font.bold if base_run else None
        
        # 按 \n\n 分割成多段落
        paragraphs = new_text.split('\n\n') if '\n\n' in new_text else [new_text]
        
        # 清空所有段落
        txBody = tf._txBody
        p_elems = txBody.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}p')
        for p_elem in p_elems[1:]:
            txBody.remove(p_elem)
        first_para.clear()
        
        for i, para_text in enumerate(paragraphs):
            para_text = para_text.strip()
            if not para_text:
                continue
            if i == 0:
                para = first_para
            else:
                para = tf.add_paragraph()
            
            run = para.add_run()
            run.text = para_text
            if font_name:
                run.font.name = font_name
            if font_size:
                run.font.size = font_size
            if font_color:
                run.font.color.rgb = font_color
            if bold is not None:
                run.font.bold = bold
        
        # ── 字体自适应：新文本比原始模板长时，按比例缩小字体 ──
        if font_size:
            new_len = len(new_text.strip())
            baseline = 0
            if original_text:
                baseline = len(original_text.strip())
            if baseline <= 0 and max_chars:
                baseline = max_chars
            # 避免占位符过短导致过度缩放：若 max_chars 存在，baseline 至少取 max_chars 的 30%
            if max_chars and baseline < max_chars * 0.3:
                baseline = int(max_chars * 0.3)
            # 绝对下限：baseline 至少 30 个字符，避免 4-5 字占位符触发极端缩放
            if baseline < 30:
                baseline = 30
            # 只有新文本明显比基准长时才缩放（避免微调也触发）
            if baseline > 0 and new_len > baseline * 1.15:
                scale = max(0.70, baseline / new_len)  # 最小缩放比例从 0.55 提升到 0.70
                new_font_size = int(font_size * scale)
                # 最小不小于 10pt (127000 EMU)
                min_size = 127000
                if new_font_size < min_size:
                    new_font_size = min_size
                if new_font_size < font_size:
                    for para in tf.paragraphs:
                        for run in para.runs:
                            if run.font.size is not None:
                                run.font.size = new_font_size
        
        return True
    
    def _get_json_value(self, data, field_path):
        parts = field_path.split(".")
        value = data
        try:
            for part in parts:
                if "[" in part:
                    name, idx_str = part.split("[")
                    idx = int(idx_str.rstrip("]"))
                    value = value[name][idx]
                else:
                    value = value[part]
            return value
        except (KeyError, IndexError, TypeError):
            return None
    
    def _handle_table(self, slide, table_config, content_json):
        """处理表格填充"""
        shape_idx = table_config.get("shape_idx")
        if shape_idx is None or shape_idx >= len(slide.shapes):
            return
        
        shape = slide.shapes[shape_idx]
        if not shape.has_table:
            return
        
        table_data = content_json.get("table", {})
        headers = table_data.get("headers", [])
        rows = table_data.get("rows", [])
        
        if headers or rows:
            table.fill_table(shape, headers, rows)
    
    def _handle_bullet(self, slide, bullet_config, content_json, preferred_key=None):
        """处理bullet列表填充"""
        shape_idx = bullet_config.get("shape_idx")
        if shape_idx is None or shape_idx >= len(slide.shapes):
            return
        
        # 优先使用与当前slide类型匹配的summary
        if preferred_key and preferred_key in content_json and "summary" in content_json[preferred_key]:
            text = content_json[preferred_key]["summary"]
            if text:
                bullet.fill_bullet_textbox(slide.shapes[shape_idx], text)
                return
        
        # fallback：按固定顺序查找
        for key in ["content_a", "content_b", "table"]:
            if key in content_json and "summary" in content_json[key]:
                text = content_json[key]["summary"]
                if text:
                    bullet.fill_bullet_textbox(slide.shapes[shape_idx], text)
                    return
    
    def save(self, output_path):
        self.prs.save(output_path)
    
    def get_report(self):
        return {
            "template_id": self.mapping.get("template_id"),
            "total_fields": self.stats["total"],
            "filled": self.stats["filled"],
            "skipped": self.stats["skipped"],
            "errors": self.stats["errors"]
        }
