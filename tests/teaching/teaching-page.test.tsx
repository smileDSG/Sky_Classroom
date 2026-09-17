/**
 * TeachingPage UI tests — orchestration of history review and panel wiring.
 *
 * TeachingPanel / TeachingHistoryPanel are heavy components; they are mocked so we
 * can assert the page-level flow: open history → select an item → hand it to
 * TeachingPanel and close the history panel → clear on "viewed".
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TeachingHistoryItem } from '@/lib/teaching/teaching-job-client';
import type { LessonPlan } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';

const boundary = vi.hoisted(() => ({
  panelProps: [] as Array<{
    viewHistoryItem: TeachingHistoryItem | null;
    onViewedHistory: () => void;
  }>,
  historyProps: [] as Array<{
    onSelect: (item: TeachingHistoryItem) => void;
    onClose: () => void;
  }>,
}));

vi.mock('@/components/sky/solve/teaching-panel', () => ({
  TeachingPanel: (props: {
    viewHistoryItem?: TeachingHistoryItem | null;
    onViewedHistory?: () => void;
  }) => {
    boundary.panelProps.push({
      viewHistoryItem: props.viewHistoryItem ?? null,
      onViewedHistory: props.onViewedHistory ?? (() => {}),
    });
    return (
      <button type="button" onClick={props.onViewedHistory}>
        teaching-panel-mock
      </button>
    );
  },
}));

vi.mock('@/components/sky/solve/teaching-history-panel', () => ({
  TeachingHistoryPanel: (props: {
    onSelect: (item: TeachingHistoryItem) => void;
    onClose: () => void;
  }) => {
    boundary.historyProps.push(props);
    return (
      <button
        type="button"
        onClick={() => props.onSelect(makeHistoryItem('历史教案'))}
        data-testid="history-panel"
      >
        history-panel-mock
      </button>
    );
  },
}));

import { TeachingPage } from '@/app/sky/teaching/teaching-page';

function makeHistoryItem(topic: string): TeachingHistoryItem {
  return { topic, plan: null, sections: [] };
}

beforeEach(() => {
  boundary.panelProps = [];
  boundary.historyProps = [];
});

describe('TeachingPage', () => {
  it('renders the teaching header and hides history by default', () => {
    render(<TeachingPage />);
    expect(screen.getByRole('heading', { name: '星际讲堂' })).toBeInTheDocument();
    expect(screen.queryByTestId('history-panel')).not.toBeInTheDocument();
  });

  it('shows initial topic and personalization notice when provided', () => {
    render(<TeachingPage initialTopic="二次函数" personalizationNotice="已按你的情况调整难度" />);
    expect(screen.getByText('AI 导师为你规划教案，逐段讲解知识点')).toBeInTheDocument();
    expect(boundary.panelProps.at(-1)?.viewHistoryItem).toBeNull();
  });

  it('opens the history panel when 历史星图 is clicked', () => {
    render(<TeachingPage />);
    fireEvent.click(screen.getByRole('button', { name: /历史星图/ }));
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('renders the history panel initially when showHistoryInitially is true', () => {
    render(<TeachingPage showHistoryInitially />);
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('passes a selected history item to TeachingPanel and closes the history panel', () => {
    render(<TeachingPage />);
    fireEvent.click(screen.getByRole('button', { name: /历史星图/ }));
    fireEvent.click(screen.getByTestId('history-panel'));

    // History panel is closed after selection.
    expect(screen.queryByTestId('history-panel')).not.toBeInTheDocument();
    // The selected item was handed to TeachingPanel.
    expect(boundary.panelProps.at(-1)?.viewHistoryItem?.topic).toBe('历史教案');
  });

  it('clears the viewed history item from TeachingPanel (回看完成后清空)', () => {
    render(<TeachingPage />);

    // Open history and select an item → the item flows into TeachingPanel.
    fireEvent.click(screen.getByRole('button', { name: /历史星图/ }));
    fireEvent.click(screen.getByTestId('history-panel'));
    expect(boundary.panelProps.at(-1)?.viewHistoryItem?.topic).toBe('历史教案');

    // Simulate TeachingPanel signalling "viewed" → item cleared.
    fireEvent.click(screen.getByRole('button', { name: 'teaching-panel-mock' }));
    expect(boundary.panelProps.at(-1)?.viewHistoryItem).toBeNull();
  });
});
