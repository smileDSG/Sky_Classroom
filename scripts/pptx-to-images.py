#!/usr/bin/env python3
"""
Convert a PPTX file to PNG images per slide.

Strategy:
  1. LibreOffice headless: PPTX → PDF
  2. (Optional) Vector formula overlay via PyMuPDF + matplotlib + svglib
  3. PyMuPDF (fitz): PDF → PNG per page

Usage:
    python pptx-to-images.py <input.pptx> <output_dir> [<sidecar.json>]

Output:
    Prints JSON: {"success": true, "images": ["Slide_1.png", "Slide_2.png", ...]}
"""

import json
import os
import platform
import subprocess
import sys
import glob
import tempfile
import shutil


def find_soffice():
    """Find the LibreOffice soffice executable."""
    system = platform.system()

    if system == "Windows":
        candidates = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]
    else:
        candidates = [
            "/usr/bin/soffice",
            "/usr/lib/libreoffice/program/soffice",
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    for path_env in os.environ.get("PATH", "").split(os.pathsep):
        soffice_path = os.path.join(path_env, "soffice" + (".exe" if system == "Windows" else ""))
        if os.path.isfile(soffice_path):
            return soffice_path

    return None


def convert_pptx_to_pdf(pptx_path, output_dir):
    """Use LibreOffice to convert PPTX to PDF."""
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError(
            "LibreOffice (soffice) not found. "
            "Please install LibreOffice: https://www.libreoffice.org/"
        )

    os.makedirs(output_dir, exist_ok=True)

    # Use a fresh temp user profile dir to avoid conflicts in concurrent/headless runs
    user_profile_dir = tempfile.mkdtemp(prefix="lo_profile_")
    user_install_url = "file:///" + user_profile_dir.replace("\\", "/")

    try:
        cmd = [
            soffice,
            "--headless",
            "--convert-to", "pdf",
            "-env:UserInstallation=" + user_install_url,
            "--outdir", output_dir,
            pptx_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"soffice failed: {result.stderr}")
    finally:
        # Clean up the temp user profile
        try:
            shutil.rmtree(user_profile_dir, ignore_errors=True)
        except OSError:
            pass

    # Find the generated PDF
    base_name = os.path.splitext(os.path.basename(pptx_path))[0]
    pdf_path = os.path.join(output_dir, base_name + ".pdf")
    if not os.path.isfile(pdf_path):
        # Sometimes LibreOffice names it differently
        pdfs = glob.glob(os.path.join(output_dir, "*.pdf"))
        if not pdfs:
            raise RuntimeError("PDF output not found after soffice conversion")
        pdf_path = pdfs[0]

    return pdf_path


import re


def sanitize_latex_for_mathtext(latex: str) -> str:
    """Replace mathtext-unsupported commands with supported equivalents."""
    # \xrightarrow{label} → \rightarrow (mathtext doesn't support \xrightarrow or Chinese labels)
    latex = re.sub(r'\\xrightarrow\{[^}]*\}', r'\\rightarrow', latex)
    latex = re.sub(r'\\xleftarrow\{[^}]*\}', r'\\leftarrow', latex)
    return latex


def overlay_formulas(pdf_path, sidecar_path):
    """
    Overlay vector-rendered formulas onto PDF pages using PyMuPDF.

    Uses matplotlib mathtext → SVG → reportlab PDF → PyMuPDF show_pdf_page().
    This produces crisp vector formulas that survive the PDF→PNG rasterization.
    """
    import fitz  # PyMuPDF
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    try:
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPDF
    except ImportError as e:
        raise RuntimeError(f"svglib/reportlab required for formula overlay: {e}")

    with open(sidecar_path, 'r', encoding='utf-8') as f:
        sidecar = json.load(f)

    formulas = sidecar.get('formulas', [])
    if not formulas:
        return pdf_path

    doc = fitz.open(pdf_path)

    # Group formulas by pageNum (1-based)
    page_formulas = {}
    for formula in formulas:
        pn = formula.get('pageNum', 1)
        page_formulas.setdefault(pn, []).append(formula)

    for page_num, flist in page_formulas.items():
        page_idx = page_num - 1  # 0-based
        if page_idx < 0 or page_idx >= len(doc):
            continue

        page = doc.load_page(page_idx)

        for formula in flist:
            latex = formula.get('latex', '')
            x = formula.get('x', 0)
            y = formula.get('y', 0)
            w = formula.get('w', 0)
            h = formula.get('h', 0)
            font_size = formula.get('fontSize', 14)
            color = formula.get('color', '#1E293B')
            if color and not color.startswith('#'):
                color = '#' + color

            if not latex or w <= 0 or h <= 0:
                continue

            # Sanitize LaTeX for mathtext compatibility
            latex = sanitize_latex_for_mathtext(latex)

            # Render LaTeX → SVG via matplotlib mathtext
            # Use a figsize proportional to the target area for quality
            fig_w = max(w * 2, 2)
            fig_h = max(h * 2, 0.5)
            fig = plt.figure(figsize=(fig_w, fig_h))
            fig.text(
                0.5, 0.5, f'${latex}$',
                fontsize=font_size,
                ha='center', va='center',
                color=color,
            )
            plt.axis('off')

            tmp_dir = tempfile.mkdtemp(prefix="formula_")
            svg_path = os.path.join(tmp_dir, 'formula.svg')
            try:
                plt.savefig(
                    svg_path,
                    format='svg',
                    dpi=300,
                    bbox_inches='tight',
                    pad_inches=0.02,
                    transparent=True,
                )
            except Exception as e:
                plt.close(fig)
                shutil.rmtree(tmp_dir, ignore_errors=True)
                print(json.dumps({"warn": f"Formula render skipped on page {page_num}: {e}"}))
                continue
            finally:
                plt.close(fig)

            # SVG → single-page PDF via svglib + reportlab
            pdf_single = os.path.join(tmp_dir, 'formula.pdf')
            try:
                drawing = svg2rlg(svg_path)
                if drawing:
                    renderPDF.drawToFile(drawing, pdf_single)

                    # Overlay onto the main PDF page at the exact PPTX position
                    # PPTX coords are in inches; PDF points = inches * 72
                    rect = fitz.Rect(x * 72, y * 72, (x + w) * 72, (y + h) * 72)
                    # First cover any LibreOffice placeholder ([Formula]) with white
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                    # Then overlay the vector formula
                    src_doc = fitz.open(pdf_single)
                    page.show_pdf_page(rect, src_doc, 0, keep_proportion=True, overlay=True)
                    src_doc.close()
            except Exception as e:
                print(json.dumps({"warn": f"Formula overlay skipped on page {page_num}: {e}"}))
            finally:
                # Cleanup temp files
                shutil.rmtree(tmp_dir, ignore_errors=True)

    # Save to temp file then replace (PyMuPDF cannot overwrite an open file)
    overlay_path = pdf_path.replace('.pdf', '_overlay.pdf')
    doc.save(overlay_path, deflate=True)
    doc.close()
    os.replace(overlay_path, pdf_path)
    return pdf_path


def pdf_to_images(pdf_path, output_dir):
    """Use PyMuPDF to convert each PDF page to a PNG image."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError("PyMuPDF (fitz) not installed. Run: pip install PyMuPDF")

    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    images = []

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        # Render at 4x resolution for crisp preview (~288 DPI)
        mat = fitz.Matrix(4, 4)
        pix = page.get_pixmap(matrix=mat)
        img_name = f"Slide_{page_num + 1}.png"
        img_path = os.path.join(output_dir, img_name)
        pix.save(img_path)
        images.append(img_name)

    doc.close()
    return images


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: pptx-to-images.py <input.pptx> <output_dir> [<sidecar.json>]"}))
        sys.exit(1)

    pptx_path = sys.argv[1]
    output_dir = sys.argv[2]
    sidecar_path = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.isfile(pptx_path):
        print(json.dumps({"success": False, "error": f"File not found: {pptx_path}"}))
        sys.exit(1)

    try:
        # Step 1: PPTX → PDF
        pdf_path = convert_pptx_to_pdf(pptx_path, output_dir)

        # Step 2: Overlay vector formulas (if sidecar provided)
        if sidecar_path and os.path.isfile(sidecar_path):
            pdf_path = overlay_formulas(pdf_path, sidecar_path)

        # Step 3: PDF → PNGs
        images = pdf_to_images(pdf_path, output_dir)

        # Cleanup intermediate PDF
        try:
            os.remove(pdf_path)
        except OSError:
            pass

        print(json.dumps({"success": True, "images": images}))
    except subprocess.TimeoutExpired:
        print(json.dumps({"success": False, "error": "soffice timed out after 60 seconds"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
