"""Convert agent-frameworks.md to .docx using python-docx."""
import re
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

INPUT = r"E:\01_Work\sky-classroom\docs\features\agent-frameworks.md"
OUTPUT = r"E:\01_Work\sky-classroom\docs\features\agent-frameworks.docx"


def set_cell_shading(cell, color_hex):
    """Set cell background color."""
    shading = cell._element.get_or_add_tcPr()
    shd = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): color_hex,
        qn('w:val'): 'clear',
    })
    shading.append(shd)


def add_code_block(doc, lines):
    """Add a code block as a formatted paragraph."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.left_indent = Inches(0.3)
    run = p.add_run('\n'.join(lines))
    run.font.name = 'Consolas'
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x2D, 0x2D, 0x2D)


def add_table(doc, header_row, data_rows):
    """Add a table with header and data rows."""
    cols = len(header_row)
    table = doc.add_table(rows=1 + len(data_rows), cols=cols)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Header
    for i, h in enumerate(header_row):
        cell = table.rows[0].cells[i]
        cell.text = h.strip()
        for p in cell.paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(10)
        set_cell_shading(cell, 'E8F0FE')

    # Data
    for r_idx, row in enumerate(data_rows):
        for c_idx in range(cols):
            cell = table.rows[r_idx + 1].cells[c_idx]
            text = row[c_idx].strip() if c_idx < len(row) else ''
            cell.text = text
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(10)

    return table


def parse_inline(paragraph, text):
    """Parse inline markdown (bold, code) and add runs."""
    # Split by bold markers and inline code
    parts = re.split(r'(\*\*.*?\*\*|`[^`]+`)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith('`') and part.endswith('`'):
            run = paragraph.add_run(part[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0xC7, 0x25, 0x4E)
        else:
            paragraph.add_run(part)


def convert():
    with open(INPUT, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    doc = Document()

    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Microsoft YaHei'
    font.size = Pt(11)
    style.element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')

    i = 0
    while i < len(lines):
        line = lines[i].rstrip('\n')

        # Empty line
        if not line:
            i += 1
            continue

        # Horizontal rule
        if line.strip() == '---':
            doc.add_paragraph('_' * 50)
            i += 1
            continue

        # Headings
        if line.startswith('# ') and not line.startswith('## '):
            h = doc.add_heading(line[2:].strip(), level=0)
            h.alignment = WD_ALIGN_PARAGRAPH.CENTER
            i += 1
            continue
        if line.startswith('## '):
            doc.add_heading(line[3:].strip(), level=1)
            i += 1
            continue
        if line.startswith('### '):
            doc.add_heading(line[4:].strip(), level=2)
            i += 1
            continue
        if line.startswith('#### '):
            doc.add_heading(line[5:].strip(), level=3)
            i += 1
            continue

        # Code block
        if line.strip().startswith('```'):
            code_lines = []
            i += 1
            while i < len(lines):
                l = lines[i].rstrip('\n')
                if l.strip().startswith('```'):
                    i += 1
                    break
                code_lines.append(l)
                i += 1
            add_code_block(doc, code_lines)
            continue

        # Table
        if '|' in line and line.strip().startswith('|'):
            table_lines = []
            while i < len(lines):
                l = lines[i].rstrip('\n')
                if '|' not in l or not l.strip().startswith('|'):
                    break
                table_lines.append(l)
                i += 1
            # Parse table
            rows = []
            for tl in table_lines:
                cells = [c.strip() for c in tl.strip().strip('|').split('|')]
                rows.append(cells)
            if len(rows) >= 2:
                # Skip separator row (---|---|---)
                header = rows[0]
                data = [r for r in rows[1:] if not all(set(c.strip()) <= {'-', ':', ' '} for c in r)]
                add_table(doc, header, data)
            continue

        # List items
        if line.startswith('- ') or line.startswith('  - '):
            indent = 0 if line.startswith('- ') else 1
            text = line.lstrip(' ').lstrip('- ').strip()
            p = doc.add_paragraph(style='List Bullet' if indent == 0 else 'List Bullet 2')
            parse_inline(p, text)
            i += 1
            continue

        # Numbered list
        m = re.match(r'^(\d+)\.\s+(.*)', line)
        if m:
            p = doc.add_paragraph(style='List Number')
            parse_inline(p, m.group(2))
            i += 1
            continue

        # Regular paragraph
        p = doc.add_paragraph()
        parse_inline(p, line.strip())
        i += 1

    doc.save(OUTPUT)
    print(f"Saved: {OUTPUT}")


if __name__ == '__main__':
    convert()
