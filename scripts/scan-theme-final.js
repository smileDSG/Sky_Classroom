const fs = require('fs');
const path = require('path');

const PAGE_GLOBS = [
  'app/page.tsx',
  'app/account/page.tsx',
  'app/settings/page.tsx',
  'app/auth/**/page.tsx',
  'app/classroom/[id]/page.tsx',
  'app/eval/**/page.tsx',
  'app/generation-preview/page.tsx',
  'app/generation-progress/page.tsx',
  'app/math-demo/page.tsx',
  'app/sky/page.tsx',
  'app/sky/assistant/page.tsx',
  'app/sky/learning/page.tsx',
  'app/sky/question-bank/page.tsx',
  'app/sky/question-bank/[id]/page.tsx',
  'app/sky/question-bank/import/page.tsx',
  'app/sky/solve/page.tsx',
  'app/sky/solve/diagnose/page.tsx',
  'app/sky/solve/math-test/page.tsx',
  'app/sky/student/page.tsx',
  'app/sky/teaching/page.tsx',
  'app/sky/teaching/shared/[token]/page.tsx',
  'app/sky/slides/page.tsx',
];

const COMPONENT_DIRS = [
  'components/sky/dashboard',
  'components/sky/learning',
  'components/sky/question-bank',
  'components/sky/solve',
  'components/sky/slides',
  'components/sky/assistant',
  'components/sky/home',
  'components/sky/layout',
  'components/ai',
];

function glob(base, pattern) {
  const parts = pattern.split('/');
  function walk(dir, pi) {
    if (pi >= parts.length) {
      const full = path.join(dir, parts[parts.length - 1]);
      if (fs.existsSync(full)) return [full];
      return [];
    }
    const part = parts[pi];
    if (part === '**') {
      const rest = parts.slice(pi + 1).join('/');
      const results = [];
      function recurse(d) {
        results.push(...glob(d, rest));
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          if (entry.isDirectory()) recurse(path.join(d, entry.name));
        }
      }
      recurse(dir);
      return results;
    }
    if (part.includes('*') || part.includes('?')) {
      const re = new RegExp(
        '^' +
          part
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '<<<STAR>>>')
            .replace(/\*/g, '[^/]*')
            .replace(/<<<STAR>>>/g, '.*')
            .replace(/\?/g, '.') +
          '$',
      );
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (re.test(entry.name)) {
          results.push(...walk(path.join(dir, entry.name), pi + 1));
        }
      }
      return results;
    }
    return walk(path.join(dir, part), pi + 1);
  }
  return walk(base, 0);
}

function collectFiles() {
  const base = path.resolve('.');
  const set = new Set();
  for (const p of PAGE_GLOBS) {
    for (const f of glob(base, p)) set.add(path.relative(base, f).replace(/\\/g, '/'));
  }
  for (const d of COMPONENT_DIRS) {
    const dir = path.join(base, d);
    if (!fs.existsSync(dir)) continue;
    function recurse(cd) {
      for (const entry of fs.readdirSync(cd, { withFileTypes: true })) {
        const fp = path.join(cd, entry.name);
        if (entry.isDirectory()) recurse(fp);
        else if (entry.name.endsWith('.tsx')) set.add(path.relative(base, fp).replace(/\\/g, '/'));
      }
    }
    recurse(dir);
  }
  return Array.from(set).sort();
}

const LIGHT_SURFACE = [
  'bg-white',
  'bg-slate-50',
  'bg-slate-100',
  'bg-slate-200',
  'bg-gray-50',
  'bg-gray-100',
  'bg-gray-200',
  'bg-zinc-50',
  'bg-zinc-100',
  'bg-neutral-50',
  'bg-stone-50',
  'from-slate-50',
  'from-slate-100',
  'from-gray-50',
  'from-gray-100',
  'from-zinc-50',
  'from-neutral-50',
  'from-stone-50',
  'from-white',
  'via-white',
  'via-slate-50',
  'via-slate-100',
  'to-white',
  'to-slate-50',
  'to-slate-100',
];

const LIGHT_TEXT = [
  'text-slate-900',
  'text-slate-800',
  'text-slate-700',
  'text-slate-600',
  'text-gray-900',
  'text-gray-800',
  'text-gray-700',
  'text-gray-600',
];

const LIGHT_BORDER = ['border-slate-200', 'border-slate-300', 'border-gray-200', 'border-gray-300'];

function makePattern(tokens) {
  return new RegExp(
    '\\b(' +
      tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
      ')(?!.*?dark:)',
  );
}

const surfaceRe = makePattern(LIGHT_SURFACE);
const textRe = makePattern(LIGHT_TEXT);
const borderRe = makePattern(LIGHT_BORDER);

const problems = [];
for (const p of collectFiles()) {
  const file = path.resolve(p);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    const clsMatches = [
      ...line.matchAll(/className\s*=\s*(?:\{[`"']?|["'`])([^"'`\}]*)[`"']?\}?/g),
    ];
    for (const m of clsMatches) {
      const cls = m[1] || '';
      const type = surfaceRe.test(cls)
        ? 'surface'
        : textRe.test(cls)
          ? 'text'
          : borderRe.test(cls)
            ? 'border'
            : null;
      if (type) {
        problems.push({ file: p, line: idx + 1, type, snippet: line.trim().slice(0, 180) });
        break;
      }
    }
    if (/style=\{\s*\{\s*background:/.test(line)) {
      problems.push({ file: p, line: idx + 1, type: 'inline', snippet: line.trim().slice(0, 180) });
    }
  });
}

const grouped = {};
for (const p of problems) (grouped[p.file] ||= []).push(p);
for (const [f, lines] of Object.entries(grouped).sort()) {
  console.log(`\n${f}`);
  for (const l of lines) console.log(`  L${l.line} [${l.type}]: ${l.snippet}`);
}
console.log(`\nFiles with issues: ${Object.keys(grouped).length}`);
