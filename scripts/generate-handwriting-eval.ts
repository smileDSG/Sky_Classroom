import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSyntheticCases } from '@/eval/handwriting-recognition/synthetic-generator';
import { renderSyntheticCase } from '@/eval/handwriting-recognition/synthetic-renderer';

const outputRoot = path.resolve(process.cwd(), 'eval/handwriting-recognition');
const imagesRoot = path.join(outputRoot, 'images');
const manifestsRoot = path.join(outputRoot, 'manifests');
const cases = buildSyntheticCases(50, 20260722);

async function main(): Promise<void> {
  await mkdir(imagesRoot, { recursive: true });
  await mkdir(manifestsRoot, { recursive: true });

  for (const sample of cases) {
    const image = renderSyntheticCase(sample, 20260722);
    await writeFile(path.join(outputRoot, sample.image), image);
  }

  const manifest = cases.map((sample) => JSON.stringify(sample)).join('\n') + '\n';
  await writeFile(path.join(manifestsRoot, 'synthetic-v1.jsonl'), manifest, 'utf8');
  await writeFile(
    path.join(outputRoot, 'README.md'),
    `# 手写识别模拟评测集\n\n` +
      `这是用于接口、页面和回归测试的 synthetic 数据集，不代表真实手写准确率。\n\n` +
      `- 样本数：${cases.length}\n` +
      `- seed：20260722\n` +
      `- 划分：tune 30、dev 10、test 10\n` +
      `- 主题：数学与物理\n` +
      `- 图片：images/*.png\n` +
      `- 标注：manifests/synthetic-v1.jsonl\n\n` +
      `重新生成：\n\n` +
      `\`\`\`powershell\n` +
      `npx tsx scripts/generate-handwriting-eval.ts\n` +
      `\`\`\`\n`,
    'utf8',
  );

  console.log(`Generated ${cases.length} synthetic samples under ${outputRoot}`);
}

void main();
