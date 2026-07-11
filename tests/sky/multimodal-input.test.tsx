import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MultimodalInput } from '@/components/sky/solve/multimodal-input';

vi.mock('@/lib/hooks/use-audio-recorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    isProcessing: false,
    recordingTime: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

describe('MultimodalInput', () => {
  it('uses camera capture as the primary mobile image input and keeps gallery as secondary', () => {
    const { container } = render(<MultimodalInput onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /拍照识题/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /从相册选/ })).toBeInTheDocument();
    expect(screen.getByText('也可以从相册选择已有照片')).toBeInTheDocument();

    const cameraInput = container.querySelector('input[aria-label="拍照识题"]');
    const galleryInput = container.querySelector('input[aria-label="从相册选择题目照片"]');

    expect(cameraInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(cameraInput).toHaveAttribute('capture', 'environment');
    expect(galleryInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(galleryInput).not.toHaveAttribute('capture');
  });
});
