const text = `概念1
名称：归有光生平
解释：字熙甫，号震川，明代散文家`;

// 简化测试
const r1 = /(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|$)/gi;
const m1 = [...text.matchAll(r1)];
console.log('Test 1 (no cleanMd):', m1.length);

// 测试 cleanMd 后的结果
const cleanMd = (s) => s.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/^\s*[-•]\s*/gm, '').trim();
const t = cleanMd(text);
console.log('After cleanMd:', JSON.stringify(t));
const m2 = [...t.matchAll(r1)];
console.log('Test 2 (with cleanMd):', m2.length);

// 测试更简单的正则
const r3 = /概念\s*\d+\s*名称[：:]\s*(.+?)\s*解释[：:]\s*(.+?)(?=概念|$)/gi;
const m3 = [...t.matchAll(r3)];
console.log('Test 3 (simpler):', m3.length);

// 测试分步匹配
const r4 = /概念\s*\d+/gi;
const m4 = [...t.matchAll(r4)];
console.log('Test 4 (find 概念):', m4.length, m4.map(m => m[0]));

const r5 = /名称[：:]\s*(.+?)\s*解释[：:]/i;
const m5 = t.match(r5);
console.log('Test 5 (find 名称+解释):', m5 ? m5[1] : 'no match');
