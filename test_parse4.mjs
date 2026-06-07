const text = `概念1
名称：归有光生平
解释：字熙甫，号震川，明代散文家，唐宋派主将，提倡写作应"出于胸臆"，以朴素文字传达深厚情感，《项脊轩志》是其抒情小品典范。

概念2
名称：项脊轩命名
解释：书斋名"脊"寓意承重`;

// 原正则（匹配不到）
const r1 = /概念\s*\d+\s*名称[：:]\s*(.+?)\s*解释[：:]\s*(.+?)(?=概念\s*\d+|$)/gi;
console.log('Original:', [...text.matchAll(r1)].length);

// 在第二个(.+?)后加 \s*
const r2 = /概念\s*\d+\s*名称[：:]\s*(.+?)\s*解释[：:]\s*(.+?)\s*(?=概念\s*\d+|$)/gi;
console.log('With trailing \s*:', [...text.matchAll(r2)].length);

// 完整正则测试
const r3 = /(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)\s*(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|$)/gi;
console.log('Full fixed:', [...text.matchAll(r3)].length);
for (const m of text.matchAll(r3)) {
  console.log('  ->', m[2], '|', m[3].substring(0, 20));
}
