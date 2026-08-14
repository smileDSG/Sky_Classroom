import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SlidesPage from '@/components/sky/slides/slides-page';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams('topic=%E5%AF%BC%E6%95%B0'),
}));

vi.mock('@/components/sky/slides/design-system/celestial-canvas', () => ({
  CelestialCanvas: () => <div />,
}));

vi.mock('@/components/sky/slides/avatar-speech-player', () => ({
  AvatarSpeechPlayer: () => null,
}));

describe('SlidesPage navigation', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    global.fetch = fetchMock;
    useTaskStore.setState({ tasks: {}, activeSolveTaskId: null });
    useSkyClassroomStore.setState({
      generationOptions: { topic: '', difficulty: 'senior' },
      activeJobId: null,
      slides: [],
    });
  });

  it('prefills a URL topic without starting cover or PPT generation', async () => {
    render(<SlidesPage />);

    const topicInput = await screen.findByPlaceholderText('例如：导数与函数单调性');
    await waitFor(() => expect(topicInput).toHaveValue('导数'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts cover generation only after the user clicks the generate button', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'test response' }),
    } as Response);
    render(<SlidesPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('例如：导数与函数单调性')).toHaveValue('导数');
    });
    fireEvent.click(screen.getByRole('button', { name: /启动生成引擎/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/sky/slides/suggest-cover',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
