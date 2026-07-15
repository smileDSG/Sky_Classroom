import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProfileOnboardingChat } from '@/components/sky/student/profile-onboarding-chat';

describe('ProfileOnboardingChat', () => {
  it('fills the input when a learner chooses a profile-aware suggestion', () => {
    const suggestion =
      '我想继续补强过拟合，希望先用代码案例和图解讲清楚，再给我一组基础练习。';

    render(
      <ProfileOnboardingChat
        suggestionPrompts={[{ label: '继续补强过拟合', text: suggestion }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '继续补强过拟合' }));

    expect(screen.getByPlaceholderText(/例如/)).toHaveValue(suggestion);
  });
});
