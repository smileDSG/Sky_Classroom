import zipfile
import os
import sys

def extract_with_root(zip_path: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for member in z.namelist():
            # 跳过 macOS 元数据
            if member.startswith('__MACOSX') or member.startswith('._'):
                continue
            # zip 内成员直接放到 out_dir 下（out_dir 作为顶层包裹）
            target = os.path.join(out_dir, member)
            if member.endswith('/'):
                os.makedirs(target, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, 'wb') as f:
                    f.write(z.read(member))
    print(f"解压完成: {out_dir}")
    print("顶层内容:", sorted(os.listdir(out_dir)))

if __name__ == "__main__":
    extract_with_root(sys.argv[1], sys.argv[2])
