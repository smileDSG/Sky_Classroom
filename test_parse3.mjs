import fs from 'fs';
const text = fs.readFileSync('logs/llm-debug-1779634449446.txt', 'utf-8');

// 提取RAW OUTPUT部分
const rawOutput = text.split('--- RAW OUTPUT ---\n')[1].split('\n--- END ---')[0];

const cleanMd = (s) => s.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/^\s*[-•]\s*/gm, '').trim();
const t = cleanMd(rawOutput);

console.log('Total length:', t.length);
console.log('First 200 chars:', t.substring(0, 200));

// 测试 pageABlock 提取
const pageABlock = t.match(/(?:第1页[：:]概念讲解页|### 第1页[：:])[^]*?(?=### 第2页|$)/i)?.[0] || t;
console.log('\npageABlock length:', pageABlock.length);
console.log('pageABlock first 100:', pageABlock.substring(0, 100));

// 测试严格正则
const conceptStrict = pageABlock.matchAll(/(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|$)/gi);
const strictMatches = [...conceptStrict];
console.log('\nStrict matches:', strictMatches.length);

// 如果匹配不到，测试更简单的正则
if (strictMatches.length === 0) {
  console.log('Contains 概念1:', t.includes('概念1'));
  console.log('Contains 名称：归有光生平:', t.includes('名称：归有光生平'));
  
  const simpleR = /概念\s*\d+\s*名称[：:]\s*(.+?)\s*解释[：:]\s*(.+?)(?=概念\s*\d+|$)/gi;
  const simpleM = [...t.matchAll(simpleR)];
  console.log('Simple regex matches:', simpleM.length);
  
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('概念')) {
      console.log(`Line ${i}: "${lines[i]}"`);
      console.log(`  next: "${lines[i+1]}"`);
      console.log(`  next+1: "${lines[i+2]}"`);
    }
  }
}
