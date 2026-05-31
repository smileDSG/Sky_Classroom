#!/usr/bin/env python3
"""
Convert a PPTX file to PNG images per slide.

Strategy:
  1. LibreOffice headless: PPTX → PDF
  2. PyMuPDF (fitz): PDF → PNG per page

Usage:
    python pptx-to-images.py <input.pptx> <output_dir>

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
        print(json.dumps({"success": False, "error": "Usage: pptx-to-images.py <input.pptx> <output_dir>"}))
        sys.exit(1)

    pptx_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.isfile(pptx_path):
        print(json.dumps({"success": False, "error": f"File not found: {pptx_path}"}))
        sys.exit(1)

    try:
        # Step 1: PPTX → PDF
        pdf_path = convert_pptx_to_pdf(pptx_path, output_dir)
        # Step 2: PDF → PNGs
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
