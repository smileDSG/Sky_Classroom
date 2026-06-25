const fs = require('fs');
const path = require('path');

const OFFENDING = new Set([
  'bg-white','bg-slate-50','bg-gray-50','bg-zinc-50','bg-neutral-50','bg-stone-50',
  'bg-sky-50','bg-blue-50','bg-indigo-50','bg-purple-50','bg-rose-50','bg-emerald-50',
  'bg-teal-50','bg-cyan-50','bg-amber-50','bg-lime-50','bg-orange-50','bg-pink-50',
  'bg-violet-50','bg-fuchsia-50','bg-red-50','bg-green-50','bg-yellow-50',
  'from-sky-50','from-white','via-white','to-white','bg-[#FFF','bg-[#fff','bg-[#fFf'
]);

const isOffending = (token) => {
  for (const o of OFFENDING) if (token.includes(o)) return true;
  return false;
};

const roots = ['app','components'];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'cloud-mind') continue;
      walk(full);
    } else if (entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
}
for (const r of roots) walk(path.resolve(r));

const problems = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    // skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    // find className assignments
    const matches = [...line.matchAll(/className\s*=\s*(?:\{[`"']?|["'`])([^"'`\}]*)[`"']?\}?/g)];
    for (const m of matches) {
      const cls = m[1];
      if (!cls) continue;
      if (isOffending(cls)) {
        if (!cls.includes('dark:')) {
          problems.push({ file, line: idx + 1, snippet: line.trim().slice(0, 200) });
        }
      }
    }
  });
}

// group by file
const grouped = {};
for (const p of problems) {
  (grouped[p.file] ||= []).push({ line: p.line, snippet: p.snippet });
}
for (const [f, lines] of Object.entries(grouped).sort()) {
  console.log(`\n${f}`);
  for (const l of lines) console.log(`  L${l.line}: ${l.snippet}`);
}
console.log(`\nTotal files: ${Object.keys(grouped).length}, total issues: ${problems.length}`);
