import { describe, expect, test, vi } from 'vitest';
import MobileLearningLegacyPage from '@/app/m/sky/learning/page';
import { redirect } from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('MobileLearningLegacyPage', () => {
  test('redirects the old learning entry to the native study lab', () => {
    MobileLearningLegacyPage();

    expect(redirect).toHaveBeenCalledWith('/m/sky/study-lab');
  });
});
