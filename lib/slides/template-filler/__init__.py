#!/usr/bin/env python3
"""PPT Template Filler Package"""
from .filler import TemplateFiller
from .bullet import fill_bullet_textbox, fill_simple_summary
from .table import fill_table
from .utils import (
    replace_run_text,
    update_page_numbers,
    convert_number,
    convert_toc_numbers,
)

__all__ = [
    "TemplateFiller",
    "fill_bullet_textbox",
    "fill_simple_summary",
    "fill_table",
    "replace_run_text",
    "update_page_numbers",
    "convert_number",
    "convert_toc_numbers",
]
