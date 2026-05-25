import fs from 'fs';
const text = fs.readFileSync('logs/llm-debug-1779636857172.txt', 'utf-8');
const rawOutput = text.split('--- RAW OUTPUT ---\n')[1].split('\n--- END ---')[0];

const cleanMd = (s) => s.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/^\s*[-•]\s*/gm, '').trim();
const t = cleanMd(rawOutput);

const firstParagraph = (s) => s.split(/\n\s*\n/)[0].trim();

// 使用当前代码中的正则
const pageABlock = t.match(/(?:第1页[：:]概念讲解页|### 第1页[：:]|第1页标题|第1页[：:])[^]*?(?=第2页|### 第2页|$)/i)?.[0] || t;
const conceptStrict = pageABlock.matchAll(/(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)\s*(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称|\n\s*本页总结|\n\s*重点分析段落|\n\s*关键句提炼|\n\s*章节)|$)/gi);
const cards = [...conceptStrict];
console.log('Concept matches:', cards.length);
for (const m of cards) console.log('  ->', m[2].trim(), '|', m[3].trim().substring(0, 30));

const pageBBlock = t.match(/(?:第2页[：:]例题\/应用页|### 第2页[：:]|第2页标题|第2页[：:])[^]*?(?=第3页|### 第3页|$)/i)?.[0] || t;
const caseStrict = pageBBlock.matchAll(/(?:案例\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:详细)?描述[：:]\s*(.+?)\s*(?=(?:案例\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称|\n\s*本页总结|\n\s*重点分析段落|\n\s*关键句提炼|\n\s*章节)|$)/gi);
const bCards = [...caseStrict];
console.log('\nCase matches:', bCards.length);
for (const m of bCards) console.log('  ->', m[2].trim(), '|', m[3].trim().substring(0, 30));
