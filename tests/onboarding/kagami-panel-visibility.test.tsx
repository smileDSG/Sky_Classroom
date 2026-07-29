import { render } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/sky/onboarding',
}));

import { KagamiPanel } from '@/components/ai/kagami-panel';

describe('KagamiPanel onboarding visibility', () => {
  it('does not cover onboarding controls', () => {
    const { container } = render(<KagamiPanel />);

    expect(container.querySelector('button[title*="Ctrl+Shift+A"]')).not.toBeInTheDocument();
  });
});
