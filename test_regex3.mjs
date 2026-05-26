// 多轮提取策略测试

const testInputs = [
  // 模拟1: LLM严格按格式输出
  `案例1\n名称：倾听技巧\n详细描述：在沟通中，倾听是最重要的技巧之一。\n\n案例2\n名称：情感反映\n详细描述：反映对方的情感状态，帮助对方理清情绪。`,
  // 模拟2: LLM用简化格式
  `1. 倾听技巧：在沟通中，倾听是最重要的技巧之一。\n2. 情感反映：反映对方的情感状态，帮助对方理清情绪。`,
  // 模拟3: LLM用列表格式
  `- 倾听技巧：在沟通中，倾听是最重要的技巧之一。\n- 情感反映：反映对方的情感状态，帮助对方理清情绪。`,
  // 模拟4: LLM用段落格式
  `倾听技巧。在沟通中，倾听是最重要的技巧之一。\n\n情感反映。反映对方的情感状态，帮助对方理清情绪。`,
];

function extractCases(text) {
  const results = [];
  
  // 第1轮: 严格格式
  const strict = text.matchAll(/(?:案例\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:详细)?描述[：:]\s*(.+?)(?=(?:案例\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称)|\n\s*\n|$)/gi);
  for (const m of strict) results.push({title: m[2].trim(), desc: m[3].trim()});
  if (results.length >= 2) return results;
  
  // 第2轮: 数字/列表 + 冒号格式
  const list = text.matchAll(/(?:^|\n)\s*(?:\d+[.．、]|[-•])\s*(.+?)[：:]\s*(.+?)(?=\n\s*(?:\d+[.．、]|[-•])|\n\s*\n|$)/gi);
  for (const m of list) results.push({title: m[1].trim(), desc: m[2].trim()});
  if (results.length >= 2) return results;
  
  // 第3轮: 任何 "xxx：yyy" 键值对（过滤掉过短的key）
  const kv = text.matchAll(/(?:^|\n)\s*(.+?)[：:]\s*(.+?)(?=\n\s*\n|$)/gi);
  for (const m of kv) {
    const k = m[1].trim();
    const v = m[2].trim();
    // 过滤掉纯标签如"详细描述""名称"等
    if (k.length >= 2 && k.length <= 15 && !/^(详细)?描述|名称|标题|总结|分析$/.test(k)) {
      results.push({title: k, desc: v});
    }
  }
  
  return results;
}

for (const input of testInputs) {
  const results = extractCases(input);
  console.log(`\n=== 输入: ${input.replace(/\n/g, '\n').substring(0, 60)}... ===`);
  console.log(`提取到 ${results.length} 个:`);
  for (const r of results) {
    console.log(`  "${r.title}" -> "${r.desc.substring(0, 40)}..."`);
  }
}
