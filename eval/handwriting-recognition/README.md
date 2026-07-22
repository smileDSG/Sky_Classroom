# 手写识别模拟评测集

这是用于接口、页面和回归测试的 synthetic 数据集，不代表真实手写准确率。

- 样本数：50
- seed：20260722
- 划分：tune 30、dev 10、test 10
- 主题：数学与物理
- 图片：images/*.png
- 标注：manifests/synthetic-v1.jsonl

重新生成：

```powershell
npx tsx scripts/generate-handwriting-eval.ts
```
