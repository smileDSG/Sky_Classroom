'use client';

import { useMemo } from 'react';
import katex from 'katex';

interface InlineMathProps {
  text: string;
  className?: string;
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
