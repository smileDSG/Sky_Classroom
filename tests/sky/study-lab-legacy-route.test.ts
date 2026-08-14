import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

import SkyStudyLabRoute from '@/app/sky/study-lab/page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('旧学习实验室入口', () => {
  it('redirects to the learning plan inside 天梯工坊', () => {
    SkyStudyLabRoute();

    expect(redirect).toHaveBeenCalledWith('/sky/learning#learning-plan');
  });
});
