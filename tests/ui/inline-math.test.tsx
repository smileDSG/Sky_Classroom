import { describe, expect, it } from 'vitest';
import { wrapBareLatexCommands } from '@/components/ui/inline-math';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { InlineMath } from '@/components/ui/inline-math';

describe('wrapBareLatexCommands', () => {
  it('wraps a bare \\neq command inside math-ish surroundings as inline math', () => {
    expect(wrapBareLatexCommands('(-1)^2 - 1 = 0 \\neq 4')).toBe('(-1)^2 - 1 = 0 $\\neq$ 4');
  });

  it('does not double-wrap commands that already sit inside $...$', () => {
    expect(wrapBareLatexCommands('$a \\neq b$')).toBe('$a \\neq b$');
  });

  it('leaves prose untouched when the command is not in a math context', () => {
    expect(wrapBareLatexCommands('纯文本说明')).toBe('纯文本说明');
  });
});

describe('InlineMath rendering', () => {
  it('renders bare \\neq as the ≠ symbol instead of leaking raw LaTeX', () => {
    render(<InlineMath text="(-1)^2 - 1 = 0 \\neq 4" />);
    expect(screen.getAllByText(/≠/).length).toBeGreaterThan(0);
  });
});
