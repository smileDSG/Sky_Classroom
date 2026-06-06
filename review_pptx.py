#!/usr/bin/env python3
"""Deep PPT review script — extracts every slide's content for bug hunting."""

import zipfile
import xml.etree.ElementTree as ET
import re, json, os

NSMAP = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
}

def get_text(shape_elem):
    """Extract all text from a shape element."""
    texts = []
    for t in shape_elem.iter():
        if t.tag.endswith('}t'):
            if t.text:
                texts.append(t.text)
    return ''.join(texts)

def get_shape_info(shape_elem, slide_ns):
    info = {"text": get_text(shape_elem)}
    # Try to get position
    xfrm = shape_elem.find('.//a:xfrm', NSMAP)
    if xfrm is not None:
        off = xfrm.find('a:off', NSMAP)
        ext = xfrm.find('a:ext', NSMAP)
        if off is not None:
            info['x'] = off.get('x')
            info['y'] = off.get('y')
        if ext is not None:
            info['cx'] = ext.get('cx')
            info['cy'] = ext.get('cy')
    # Check for table
    tbl = shape_elem.find('.//a:tbl', NSMAP)
    if tbl is not None:
        rows = []
        for tr in tbl.findall('a:tr', NSMAP):
            row = []
            for tc in tr.findall('a:tc', NSMAP):
                row.append(get_text(tc))
            rows.append(row)
        info['table'] = rows
    # Check for graphicFrame (chart, diagram, etc.)
    graphicFrame = shape_elem.find('.//p:graphicFrame', NSMAP)
    if graphicFrame is not None:
        info['type'] = 'graphicFrame'
    # Check for picture
    pic = shape_elem.find('.//p:pic', NSMAP)
    if pic is not None:
        info['type'] = 'picture'
    # Check for shape type
    spPr = shape_elem.find('.//p:spPr', NSMAP)
    if spPr is not None:
        prstGeom = spPr.find('a:prstGeom', NSMAP)
        if prstGeom is not None:
            info['shapeType'] = prstGeom.get('prst')
    # Check for math
    omath = shape_elem.find('.//m:oMath', NSMAP)
    if omath is not None:
        info['hasMath'] = True
        info['mathText'] = get_text(omath)
    return info

def parse_slide(xml_bytes, slide_num):
    """Parse a slide XML and return structured info."""
    text = xml_bytes.decode('utf-8', errors='replace')
    # Fix common namespace issues in pptxgenjs output
    # Remove w: prefix elements that are invalid in presentationML
    text = re.sub(r'<w:rPr\s*/?>', '', text)
    # Register namespaces
    for prefix, uri in NSMAP.items():
        try:
            ET.register_namespace(prefix, uri)
        except:
            pass
    
    root = ET.fromstring(text.encode('utf-8'))
    shapes = []
    for sp in root.iter():
        tag = sp.tag.split('}')[-1] if '}' in sp.tag else sp.tag
        if tag in ('sp', 'pic', 'graphicFrame', 'grpSp', 'cxnSp'):
            info = get_shape_info(sp, NSMAP)
            if info.get('text') or info.get('table') or info.get('type') == 'picture' or info.get('hasMath'):
                shapes.append(info)
    return shapes

z = zipfile.ZipFile("temp_review.pptx")
slide_files = sorted([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml') and 'layout' not in n and 'master' not in n],
                     key=lambda x: int(re.search(r'slide(\d+)\.xml', x).group(1)))

all_slides = []
for i, sf in enumerate(slide_files, 1):
    xml = z.read(sf)
    shapes = parse_slide(xml, i)
    all_slides.append({"slide": i, "shapes": shapes})

# Save full JSON for analysis
with open('review_full.json', 'w', encoding='utf-8') as f:
    json.dump(all_slides, f, ensure_ascii=False, indent=2)
print(f"Extracted {len(all_slides)} slides to review_full.json")
