import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LearningProfilePrompt } from '@/components/sky/dashboard/learning-profile-prompt';
import { PersonalizationForm } from '@/components/account/personalization-form';

describe('learning profile completion entries', () => {
  it('renders an onboarding link for skipped users', () => {
    render(<LearningProfilePrompt status="skipped" />);

    expect(screen.getByRole('link', { name: '完善用户画像' })).toHaveAttribute(
      'href',
      '/sky/onboarding?mode=edit&redirect=%2Fsky',
    );
  });

  it('renders nothing for completed users on the dashboard', () => {
    const { container } = render(<LearningProfilePrompt status="completed" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('uses /sky/onboarding?mode=edit for the account entry', () => {
    render(<PersonalizationForm />);

    expect(screen.getByRole('link', { name: '填写/编辑用户画像' })).toHaveAttribute(
      'href',
      '/sky/onboarding?mode=edit&redirect=%2Faccount',
    );
  });
});
