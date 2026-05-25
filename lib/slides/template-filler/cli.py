#!/usr/bin/env python3
"""
Template Filler CLI
用于从Node.js/Next.js API路由调用

Usage:
    python cli.py --template-id modern-geometric --content-json '{...}' --output /tmp/out.pptx
"""
import argparse
import json
import os
import sys

# 将当前目录加入路径，确保能导入 filler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from filler import TemplateFiller


def main():
    parser = argparse.ArgumentParser(description="Fill PPT template with JSON content")
    parser.add_argument("--template-id", required=True, help="Template ID, e.g. modern-geometric")
    parser.add_argument("--content-json", required=True, help="JSON content string")
    parser.add_argument("--output", required=True, help="Output PPTX path")
    parser.add_argument("--number-style", default="arabic", choices=["arabic", "chinese", "chinese-capital"],
                        help="Number conversion style")
    parser.add_argument("--template-dir", default="十二套教学用ppt",
                        help="Directory containing template PPTX files")
    parser.add_argument("--mapping-dir", default="lib/slides/template-packs/mappings",
                        help="Directory containing mapping JSON files")
    args = parser.parse_args()

    # 解析JSON
    try:
        content = json.loads(args.content_json)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    # 动态扫描目录匹配模板文件（避免中文编码问题）
    template_path = None
    for fname in os.listdir(args.template_dir):
        if fname.startswith('~$') or not fname.endswith('.pptx'):
            continue
        if args.template_id in fname.lower().replace('-', ''):
            template_path = os.path.join(args.template_dir, fname)
            break
    
    if not template_path:
        # fallback: 尝试直接匹配
        id_to_name = {
            'modern-geometric': ['modern', 'geometric', '现代', '几何'],
            'cartoon': ['cartoon', '卡通', '明快'],
            'classical': ['classical', '古典', '书香'],
            'nordic': ['nordic', '北欧', '简约'],
            'business': ['business', '商务', '专业'],
            'sports': ['sports', '运动', '活力'],
            'ocean': ['ocean', '海洋', '探索'],
            'watercolor': ['watercolor', '水彩', '清新水彩'],
            'nature': ['nature', '自然', '清新自然'],
            'humanistic': ['humanistic', '人文', '温暖'],
            'vintage': ['vintage', '田园', '复古'],
            'tech': ['tech', '科技', '未来'],
        }
        keywords = id_to_name.get(args.template_id, [args.template_id])
        for fname in os.listdir(args.template_dir):
            if fname.startswith('~$') or not fname.endswith('.pptx'):
                continue
            if any(kw.lower() in fname.lower() for kw in keywords):
                template_path = os.path.join(args.template_dir, fname)
                break

    mapping_path = os.path.join(args.mapping_dir, f"{args.template_id}.json")

    # 检查文件存在
    if not template_path or not os.path.exists(template_path):
        print(json.dumps({"success": False, "error": f"Template not found for {args.template_id}"}))
        sys.exit(1)
    if not os.path.exists(mapping_path):
        print(json.dumps({"success": False, "error": f"Mapping not found: {mapping_path}"}))
        sys.exit(1)

    # 执行填充
    try:
        filler = TemplateFiller(template_path, mapping_path)
        stats = filler.fill(content, number_style=args.number_style)
        filler.save(args.output)

        report = filler.get_report()
        result = {
            "success": True,
            "output": args.output,
            **report
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
