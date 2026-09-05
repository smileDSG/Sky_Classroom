import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { PersonalizationContext } from '@/lib/cloud-mind/types';

const fetchMock = vi.fn();

const contextPayload = {
  success: true,
  data: {
    userId: 'u1',
    generatedAt: Date.now(),
    hasLearningData: true,
    weakPoints: [],
    masteryByKnowledge: {},
    recentAccuracy: null,
    dueReviews: [],
    errorPatterns: [],
    preferredDifficulty: 'medium',
    recommendation: { title: 't', reason: 'r', targetTool: 'quiz' },
  } as unknown as PersonalizationContext,
};

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/sky/student/profile-onboarding-chat', () => ({
  ProfileOnboardingChat: ({ onPatchChange }: { onPatchChange?: (patch: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onPatchChange?.({
          learningGoal: { value: '两周内补机器学习', confidence: 0.9, evidence: [] },
        })
      }
    >
      simulate-patch
    </button>
  ),
}));

describe('ProfileCompletionPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => contextPayload,
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('reloads the personalization context after a chat patch arrives', async () => {
    const { ProfileCompletionPage } =
      await import('@/components/sky/learning/profile-completion-page');

    render(<ProfileCompletionPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('simulate-patch'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/sky/cloud-mind/personalization-context',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
});
