import zipfile
import os
import shutil

SRC = r"E:\01_Work\sky-classroom\22016688智眸无界.zip"
NESTED = r"E:\01_Work\sky_classroom-multiagent"   # 上一轮误建的嵌套目录，清理掉
DST = r"E:\01_Work"                               # 直接解压到此处，zip 内部顶层即为 sky_classroom-multiagent/

# 清理上一轮误建的嵌套目录
if os.path.isdir(NESTED):
    shutil.rmtree(NESTED)
    print("已清理嵌套目录:", NESTED)

with zipfile.ZipFile(SRC) as z:
    z.extractall(DST)

final = os.path.join(DST, "sky_classroom-multiagent")
print("解压完成:", final)
print("顶层内容:", sorted(os.listdir(final)))
