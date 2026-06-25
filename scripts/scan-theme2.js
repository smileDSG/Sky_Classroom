const fs = require('fs');
const path = require('path');

// Surface-only light tokens likely to break dark mode
const PATTERNS = [
  { re: /\bbg-white\b(?!\d)/, dark: 'dark:bg-slate-900' },
  { re: /\bbg-slate-50\b/, dark: 'dark:bg-slate-900/60' },
  { re: /\bbg-gray-50\b/, dark: 'dark:bg-gray-900' },
  { re: /\bbg-zinc-50\b/, dark: 'dark:bg-zinc-900' },
  { re: /\bbg-neutral-50\b/, dark: 'dark:bg-neutral-900' },
  { re: /\bbg-stone-50\b/, dark: 'dark:bg-stone-900' },
  { re: /\bbg-sky-50\b/, dark: 'dark:bg-sky-950/30' },
  { re: /\bbg-blue-50\b/, dark: 'dark:bg-blue-950/30' },
  { re: /\bbg-indigo-50\b/, dark: 'dark:bg-indigo-950/30' },
  { re: /\bbg-purple-50\b/, dark: 'dark:bg-purple-950/30' },
  { re: /\bbg-rose-50\b/, dark: 'dark:bg-rose-950/30' },
  { re: /\bbg-emerald-50\b/, dark: 'dark:bg-emerald-950/30' },
  { re: /\bbg-teal-50\b/, dark: 'dark:bg-teal-950/30' },
  { re: /\bbg-cyan-50\b/, dark: 'dark:bg-cyan-950/30' },
  { re: /\bbg-amber-50\b/, dark: 'dark:bg-amber-950/30' },
  { re: /\bbg-lime-50\b/, dark: 'dark:bg-lime-950/30' },
  { re: /\bbg-orange-50\b/, dark: 'dark:bg-orange-950/30' },
  { re: /\bbg-pink-50\b/, dark: 'dark:bg-pink-950/30' },
  { re: /\bbg-violet-50\b/, dark: 'dark:bg-violet-950/30' },
  { re: /\bbg-fuchsia-50\b/, dark: 'dark:bg-fuchsia-950/30' },
  { re: /\bbg-red-50\b/, dark: 'dark:bg-red-950/30' },
  { re: /\bbg-green-50\b/, dark: 'dark:bg-green-950/30' },
  { re: /\bbg-yellow-50\b/, dark: 'dark:bg-yellow-950/30' },
  { re: /\bfrom-sky-50\b/, dark: 'dark:from-slate-950' },
  { re: /\bfrom-white\b/, dark: 'dark:from-slate-900' },
  { re: /\bvia-white\b/, dark: 'dark:via-slate-900' },
  { re: /\bto-white\b/, dark: 'dark:to-slate-900' },
  { re: /\bbg-white\/([0-9]+)\b/, type: 'opacity' },
  { re: /\bbg-\[#/, type: 'hex' },
];

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
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    const matches = [...line.matchAll(/className\s*=\s*(?:\{[`"']?|["'`])([^"'`\}]*)[`"']?\}?/g)];
    for (const m of matches) {
      const cls = m[1];
      if (!cls) continue;
      if (cls.includes('dark:')) continue;
      for (const p of PATTERNS) {
        if (p.type === 'opacity') {
          const match = cls.match(/bg-white\/([0-9]+)/);
          if (match) {
            const op = match[1];
            // heuristic: only flag card/panel backgrounds with higher opacity (>=50)
            if (parseInt(op, 10) >= 50) {
              problems.push({ file, line: idx + 1, snippet: line.trim().slice(0, 200), cls });
              break;
            }
          }
        } else if (p.type === 'hex') {
          if (/bg-\[#[fF]{3,6}\b/.test(cls)) {
            problems.push({ file, line: idx + 1, snippet: line.trim().slice(0, 200), cls });
            break;
          }
        } else if (p.re.test(cls)) {
          problems.push({ file, line: idx + 1, snippet: line.trim().slice(0, 200), cls, suggest: p.dark });
          break;
        }
      }
    }
  });
}

const grouped = {};
for (const p of problems) (grouped[p.file] ||= []).push(p);
for (const [f, lines] of Object.entries(grouped).sort()) {
  console.log(`\n${f}`);
  for (const l of lines) console.log(`  L${l.line}: ${l.snippet}`);
}
console.log(`\nTotal files: ${Object.keys(grouped).length}, total issues: ${problems.length}`);
