const text = `
第1页标题：文脉寻踪核心概念

概念1
名称：归有光生平
解释：字熙甫，号震川，明代散文家，唐宋派主将，提倡写作应“出于胸臆”，以朴素文字传达深厚情感，《项脊轩志》是其抒情小品典范。

概念2
名称：项脊轩命名
解释：书斋名“脊”寓意承重，又因归氏远祖曾居昆山项脊泾，命名遥寄追远之思，使一座小轩成为家族记忆与个人志向的凝结点。

本页总结：梳理作者家世...
`;

const cleanMd = (s) => s.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/^\s*[-•]\s*/gm, '').trim();
const t = cleanMd(text);

// 测试严格正则
const conceptStrict = t.matchAll(/(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|$)/gi);
const strictMatches = [...conceptStrict];
console.log('Strict matches:', strictMatches.length);
for (const m of strictMatches) {
  console.log('  title:', m[2].trim(), '| desc:', m[3].trim().substring(0, 30));
}

// 测试第2轮：列表格式
const listMatches = t.matchAll(/(?:^|\n)\s*(?:\d+[.．、]|[-•])\s*(.+?)[：:]\s*(.+?)(?=\n\s*(?:\d+[.．、]|[-•])|\n\s*\n|$)/gi);
const list = [...listMatches];
console.log('List matches:', list.length);

// 测试第3轮：宽松键值对
const kvMatches = t.matchAll(/(?:^|\n)\s*(.+?)[：:]\s*(.+?)(?=\n\s*\n|$)/gi);
const kv = [...kvMatches];
console.log('KV matches:', kv.length);
for (const m of kv.slice(0, 5)) {
  console.log('  k:', m[1].trim(), '| v:', m[2].trim().substring(0, 30));
}
