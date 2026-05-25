import fs from 'fs';
const text = fs.readFileSync('logs/llm-debug-1779634449446.txt', 'utf-8');
const rawOutput = text.split('--- RAW OUTPUT ---\n')[1].split('\n--- END ---')[0];

const cleanMd = (s) => s.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/^\s*[-•]\s*/gm, '').trim();
const t = cleanMd(rawOutput);

const firstParagraph = (s) => s.split(/\n\s*\n/)[0].trim();
const maxACards = 5;
const maxBCards = 5;

// 概念提取
const pageABlock = t.match(/(?:第1页[：:]概念讲解页|### 第1页[：:]|第1页标题)[^]*?(?=第2页|### 第2页|$)/i)?.[0] || t;
const cards = [];
const conceptStrict = pageABlock.matchAll(/(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)\s*(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称|\n\s*本页总结|\n\s*重点分析段落|\n\s*关键句提炼|\n\s*章节)|$)/gi);
for (const m of conceptStrict) cards.push({ title: m[2].trim(), desc: firstParagraph(m[3].trim()) });
console.log('=== Concepts ===');
console.log('Matches:', cards.length);
for (const c of cards) console.log(`  ${c.title}: ${c.desc.substring(0, 40)}...`);

// 案例提取
const pageBBlock = t.match(/(?:第2页[：:]例题\/应用页|### 第2页[：:]|第2页标题)[^]*?(?=第3页|### 第3页|$)/i)?.[0] || t;
const bCards = [];
const caseStrict = pageBBlock.matchAll(/(?:案例\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:详细)?描述[：:]\s*(.+?)\s*(?=(?:案例\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称|\n\s*本页总结|\n\s*重点分析段落|\n\s*关键句提炼|\n\s*章节)|$)/gi);
for (const m of caseStrict) bCards.push({ title: m[2].trim(), desc: firstParagraph(m[3].trim()) });
console.log('\n=== Cases ===');
console.log('Matches:', bCards.length);
for (const c of bCards) console.log(`  ${c.title}: ${c.desc.substring(0, 40)}...`);

// 表格提取
const pageCBlock = t.match(/(?:第3页[：:]数据对比页|### 第3页[：:]|第3页标题)[^]*?(?=(?:## |章节|$))/i)?.[0] || t;
const headers = [];
const headerMatch = pageCBlock.match(/表头[：:]\s*(.+?)(?=\n|$)/i);
if (headerMatch) headers.push(...headerMatch[1].split(/[,，、|]/).map(h => h.trim()).filter(Boolean));
const rows = [];
const rowMatches = pageCBlock.matchAll(/(?:^|\n)\s*(?:[-•]\s*)?(?:行\s*\d+\s*)?[：:]?\s*(.+?)(?=\n|$)/gi);
for (const m of rowMatches) {
  const cols = m[1].split(/[,，、|]/).map(c => c.trim()).filter(Boolean);
  if (cols.length >= 2 && cols.length <= 6 && !cols[0].startsWith('表头') && !cols[0].startsWith('表格总结')) rows.push(cols);
}
console.log('\n=== Table ===');
console.log('Headers:', headers);
console.log('Rows:', rows.length);
for (const r of rows) console.log('  ', r);
