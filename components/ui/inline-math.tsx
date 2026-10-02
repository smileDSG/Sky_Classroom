'use client';

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface InlineMathProps {
  text: string;
  className?: string;
}

// Parameterless LaTeX commands that are safe to render on their own as inline math.
const BARE_CMD = new Set([
  'neq',
  'le',
  'ge',
  'leq',
  'geq',
  'times',
  'div',
  'pm',
  'sum',
  'int',
  'prod',
  'infty',
  'cdot',
  'dots',
  'cup',
  'cap',
  'emptyset',
  'subset',
  'subseteq',
  'supset',
  'supseteq',
  'in',
  'notin',
  'to',
  'rightarrow',
  'leftarrow',
  'approx',
  'sim',
  'cong',
  'propto',
  'forall',
  'exists',
  'neg',
  'land',
  'lor',
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'theta',
  'lambda',
  'mu',
  'pi',
  'sigma',
  'phi',
  'omega',
  'nabla',
]);

const BARE_PATTERN = new RegExp(`\\\\(${Array.from(BARE_CMD).join('|')})\\b`, 'g');

export function wrapBareLatexCommands(text: string): string {
  // Protect already-wrapped $...$ segments so their inner commands aren't doubled.
  const protectedSegments: string[] = [];
  const shielded = text.replace(/\$[^$]+\$/g, (m) => {
    protectedSegments.push(m);
    return `\u0000${protectedSegments.length - 1}\u0000`;
  });

  const wrapped = shielded.replace(
    BARE_PATTERN,
    (match, _cmd: string, offset: number, whole: string) => {
      // Only wrap when the command is adjacent to math-ish content, not in prose.
      const before = offset > 0 ? whole[offset - 1] : '';
      const after = offset + match.length < whole.length ? whole[offset + match.length] : '';
      const mathish = /[0-9a-zA-Z(){}\\]|\s/.test(before) && /[\s0-9=<>,.;]/.test(after);
      return mathish ? `$${match}$` : match;
    },
  );

  return protectedSegments.reduce((acc, seg, i) => acc.replace(`\u0000${i}\u0000`, seg), wrapped);
}

export function InlineMath({ text, className }: InlineMathProps) {
  const parts = useMemo(() => {
    const result: { type: 'text' | 'math' | 'block-math'; value: string }[] = [];

    // Preprocess: normalize delimiters and fix common LaTeX issues
    let preprocessed = text;
    // Normalize \(...\) → $...$ and \[...\] → $$...$$
    preprocessed = preprocessed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');
    preprocessed = preprocessed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    // Convert common Unicode math symbols to LaTeX
    preprocessed = preprocessed
      .replace(/≤/g, '\\leq')
      .replace(/≥/g, '\\geq')
      .replace(/≠/g, '\\neq')
      .replace(/×/g, '\\times')
      .replace(/÷/g, '\\div')
      .replace(/±/g, '\\pm')
      .replace(/∑/g, '\\sum')
      .replace(/∫/g, '\\int')
      .replace(/∞/g, '\\infty')
      .replace(/∂/g, '\\partial')
      .replace(/√/g, '\\sqrt')
      .replace(/·/g, '\\cdot')
      .replace(/…/g, '\\dots');
    // Fix \sqrt(...) → \sqrt{...}
    preprocessed = preprocessed.replace(/\\sqrt(\[[^\]]*\])?\(([^)]+)\)/g, '\\sqrt$1{$2}');
    // Wrap bare LaTeX commands (not inside $...$) as inline math so that
    // faint commands like \neq still render instead of leaking as raw text.
    preprocessed = wrapBareLatexCommands(preprocessed);

    // Split by $$...$$ first, then by $...$
    const blockRegex = /\$\$([\s\S]*?)\$\$/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(preprocessed)) !== null) {
      if (match.index > lastIndex) {
        result.push(...parseInlineMath(preprocessed.slice(lastIndex, match.index)));
      }
      result.push({ type: 'block-math', value: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < preprocessed.length) {
      result.push(...parseInlineMath(preprocessed.slice(lastIndex)));
    }
    return result;
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>;
        }
        try {
          const html = katex.renderToString(part.value, {
            throwOnError: false,
            displayMode: part.type === 'block-math',
          });
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: html }}
              className={part.type === 'block-math' ? 'block text-center my-2' : ''}
            />
          );
        } catch {
          return (
            <span key={i} className="text-red-500">
              {part.value}
            </span>
          );
        }
      })}
    </span>
  );
}

function parseInlineMath(text: string): { type: 'text' | 'math'; value: string }[] {
  const result: { type: 'text' | 'math'; value: string }[] = [];
  const regex = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    result.push({ type: 'math', value: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    result.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return result.length > 0 ? result : [{ type: 'text', value: text }];
}
