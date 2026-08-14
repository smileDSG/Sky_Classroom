import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PersonalizationForm } from '@/components/account/personalization-form';

const serverPreferences = {
  userId: 'user-1',
  preferredLanguage: 'zh-CN',
  contentFormatPreferences: ['worked-example', 'diagram'],
  explanationDepth: 'detailed',
  learningPace: 'slow',
  stepByStepMode: 'hints-first',
  interactionTone: 'encouraging',
  assistantName: '苏绣导师',
  preferenceNotes: '优先使用图示与例题。',
  privacy: {
    conversationMemory: 'session',
    optionalBehaviorSignals: false,
    privateKnowledgeRetrieval: true,
  },
  version: 3,
  schemaVersion: '1.0.0',
  updatedAt: '2026-07-28T08:00:00.000Z',
  updatedBy: 'user',
};

const fetchMock = vi.fn();

describe('PersonalizationForm', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads the authoritative learner profile instead of local personalization state', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, preferences: serverPreferences }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<PersonalizationForm />);

    fireEvent.click(await screen.findByRole('tab', { name: /AI/ }));
    expect(await screen.findByDisplayValue('苏绣导师')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/user/learner-profile',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('rejects a malformed success envelope instead of displaying its profile data', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, preferences: serverPreferences }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(<PersonalizationForm />);

    expect(await screen.findByRole('alert')).toHaveTextContent('返回的学习情况不完整');
    expect(screen.queryByRole('tab', { name: /AI/ })).not.toBeInTheDocument();
  });

  it('locks profile controls while saving and sends only client-safe preferences', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, preferences: serverPreferences }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    let resolveSave!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveSave = resolve)),
    );

    render(<PersonalizationForm />);

    fireEvent.click(await screen.findByRole('tab', { name: /AI/ }));
    fireEvent.change(screen.getByLabelText('AI 助手称呼'), {
      target: { value: '新导师' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存学习情况' }));

    expect(screen.getByRole('button', { name: /保存学习情况/ })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '学习节奏' })).toBeDisabled();

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      expectedVersion: 3,
      preferences: { assistantName: '新导师' },
    });
    expect(body.preferences).not.toHaveProperty('userId');
    expect(body.preferences).not.toHaveProperty('version');

    resolveSave(
      new Response(
        JSON.stringify({
          success: true,
          preferences: { ...serverPreferences, assistantName: '新导师', version: 4 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    expect(await screen.findByText('学习情况已保存。')).toBeInTheDocument();
  });

  it('shows explicit initialization and creates a missing profile at version zero', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errorCode: 'PROFILE_NOT_FOUND',
            error: 'Learner profile not found',
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            preferences: {
              ...serverPreferences,
              version: 1,
              assistantName: '小智',
              explanationDepth: 'standard',
              learningPace: 'standard',
              stepByStepMode: 'when-needed',
              preferenceNotes: '',
              privacy: {
                conversationMemory: 'session',
                optionalBehaviorSignals: false,
                privateKnowledgeRetrieval: false,
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    render(<PersonalizationForm />);

    expect(await screen.findByText(/还没有保存学习情况/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存学习情况' }));

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ expectedVersion: 0 });
    expect(await screen.findByText('学习情况已保存。')).toBeInTheDocument();
  });

  it('surfaces version conflicts and blocks stale resubmission', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, preferences: serverPreferences }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errorCode: 'PROFILE_VERSION_CONFLICT',
            error: 'Expected profile version does not match latest version',
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
      );

    render(<PersonalizationForm />);

    fireEvent.click(await screen.findByRole('tab', { name: /AI/ }));
    fireEvent.change(screen.getByLabelText('AI 助手称呼'), {
      target: { value: '冲突草稿' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存学习情况' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('学习情况已在其他位置更新');
    expect(screen.getByDisplayValue('冲突草稿')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存学习情况' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '加载最新学习情况' })).toBeInTheDocument();
  });
});
