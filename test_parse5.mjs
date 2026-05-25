const text = `案例1
名称：修葺轩室动作
详细描述：补漏防塌，辟窗建垣，又杂植兰桂竹木...

案例2
名称：诸父分炊空间
详细描述：叔伯分家后，院中添设小门墙...`;

// 测试案例正则
const r1 = /(?:案例\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:详细)?描述[：:]\s*(.+?)(?=(?:案例\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|$)/gi;
console.log('Original case regex:', [...text.matchAll(r1)].length);

// 修复版本（加 \s* 在 lookahead 前）
const r2 = /(?:案例\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:详细)?描述[：:]\s*(.+?)\s*(?=(?:案例\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|$)/gi;
console.log('Fixed case regex:', [...text.matchAll(r2)].length);
for (const m of text.matchAll(r2)) {
  console.log('  ->', m[2], '|', m[3].substring(0, 20));
}
