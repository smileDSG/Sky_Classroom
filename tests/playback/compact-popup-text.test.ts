import { describe, expect, it } from 'vitest';

import {
  computePlaybackView,
  getCompactPopupText,
  getSpeechTextForView,
} from '@/lib/playback/derived-state';

describe('getCompactPopupText', () => {
  it('does not show idle text when no speech is active', () => {
    expect(
      getCompactPopupText({
        engineMode: 'playing',
        isInLiveFlow: false,
        lectureSpeech: null,
        currentSpeech: null,
        userMessage: null,
        sourceText: 'first lecture line',
      }),
    ).toBeNull();
  });

  it('shows the active lecture text while speech is active', () => {
    expect(
      getCompactPopupText({
        engineMode: 'playing',
        isInLiveFlow: false,
        lectureSpeech: 'current spoken line',
        currentSpeech: null,
        userMessage: null,
        sourceText: 'current spoken line',
      }),
    ).toBe('current spoken line');
  });

  it('shows live speech text during active discussion flow', () => {
    expect(
      getCompactPopupText({
        engineMode: 'live',
        isInLiveFlow: true,
        lectureSpeech: null,
        currentSpeech: 'student response',
        userMessage: null,
        sourceText: 'student response',
      }),
    ).toBe('student response');
  });
});

describe('getSpeechTextForView', () => {
  it('uses audio text only while TTS audio is actively playing', () => {
    expect(
      getSpeechTextForView({
        ttsEnabled: true,
        ttsMuted: false,
        audioIndicatorState: 'playing',
        audioSpeech: 'spoken segment',
        liveSpeech: 'streamed segment',
      }),
    ).toBe('spoken segment');
  });

  it('does not fall back to stale live text after TTS audio ends', () => {
    expect(
      getSpeechTextForView({
        ttsEnabled: true,
        ttsMuted: false,
        audioIndicatorState: 'idle',
        audioSpeech: null,
        liveSpeech: 'stale streamed segment',
      }),
    ).toBeNull();
  });

  it('uses live text when TTS is disabled', () => {
    expect(
      getSpeechTextForView({
        ttsEnabled: false,
        ttsMuted: false,
        audioIndicatorState: 'idle',
        audioSpeech: null,
        liveSpeech: 'streamed segment',
      }),
    ).toBe('streamed segment');
  });
});

describe('computePlaybackView', () => {
  it('does not surface the first scene speech while playback is between speech actions', () => {
    const view = computePlaybackView({
      engineMode: 'playing',
      lectureSpeech: null,
      liveSpeech: null,
      speakingAgentId: null,
      thinkingState: null,
      isCueUser: false,
      isTopicPending: false,
      chatIsStreaming: false,
      discussionTrigger: null,
      playbackCompleted: false,
      idleText: 'first scene speech',
      speakingStudent: false,
      sessionType: null,
    });

    expect(view.phase).toBe('lecturePlaying');
    expect(view.sourceText).toBe('');
    expect(view.bubbleRole).toBeNull();
    expect(
      getCompactPopupText({
        engineMode: 'playing',
        isInLiveFlow: view.isInLiveFlow,
        lectureSpeech: null,
        currentSpeech: null,
        userMessage: null,
        sourceText: view.sourceText,
      }),
    ).toBeNull();
  });
});
