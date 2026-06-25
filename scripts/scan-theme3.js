const fs = require('fs');
const path = require('path');

const PAGES = [
  'app/page.tsx',
  'app/account/page.tsx',
  'app/settings/page.tsx',
  'app/auth/login/page.tsx',
  'app/auth/register/page.tsx',
  'app/auth/forgot-password/page.tsx',
  'app/auth/reset-password/page.tsx',
  'app/auth/verify-email/page.tsx',
  'app/classroom/[id]/page.tsx',
  'app/eval/whiteboard/page.tsx',
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
  'app/sky/student/student-profile-page.tsx',
  'app/sky/teaching/page.tsx',
  'app/sky/teaching/shared/[token]/page.tsx',
  'app/sky/slides/page.tsx',
];

const surfaceRe = /\b(bg-white|bg-slate-50|bg-gray-50|bg-zinc-50|bg-neutral-50|bg-stone-50|from-sky-50|from-white|via-white|to-white|bg-\[#)(?!.*?dark:)/;
const hardBgRe = /style=\{\s*\{\s*background:/;

const problems = [];
for (const p of PAGES) {
  const file = path.resolve(p);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    // className missing dark
    const clsMatches = [...line.matchAll(/className\s*=\s*(?:\{[`"']?|["'`])([^"'`\}]*)[`"']?\}?/g)];
    for (const m of clsMatches) {
      const cls = m[1] || '';
      if (surfaceRe.test(cls)) {
        problems.push({ file: p, line: idx + 1, type: 'class', snippet: line.trim().slice(0, 160) });
        break;
      }
    }
    // hardcoded inline background
    if (hardBgRe.test(line)) {
      problems.push({ file: p, line: idx + 1, type: 'inline', snippet: line.trim().slice(0, 160) });
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
