import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportPreview } from '@/components/sky/question-bank/import-preview';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { ImportRowError } from '@/lib/question-bank/importers/types';

describe('ImportPreview', () => {
  const mockConfirm = vi.fn();
  const mockCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no entries', () => {
    render(
      <ImportPreview
        entries={[]}
        errors={[]}
        fileName="test.json"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />,
    );

    expect(screen.getByText(/没有可导入的数据/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /确认导入/ })).toBeDisabled();
  });

  it('renders valid entries in preview table', () => {
    const entries: QuestionBankInsert[] = [
      { subject: '数学', grade: '高一', difficulty: 'easy', questionType: 'choice', content: '1+1=?', answer: '2' },
      { subject: '物理', grade: '高二', difficulty: 'medium', questionType: 'solve', content: 'F=ma', answer: 'a=F/m' },
    ];

    render(
      <ImportPreview
        entries={entries}
        errors={[]}
        fileName="test.json"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />,
    );

    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByText('物理')).toBeInTheDocument();
    expect(screen.getByText('1+1=?')).toBeInTheDocument();
    expect(screen.getByText('F=ma')).toBeInTheDocument();
    expect(screen.getByText(/有效: 2/)).toBeInTheDocument();
  });

  it('renders error rows and error summary', () => {
    const entries: QuestionBankInsert[] = [
      { subject: '数学', grade: '', difficulty: 'easy', questionType: 'fill', content: '2+2=?', answer: '4' },
    ];
    const errors: ImportRowError[] = [
      { row: 2, field: 'content', reason: '题目内容不能为空' },
      { row: 2, field: 'answer', reason: '答案不能为空' },
    ];

    render(
      <ImportPreview
        entries={entries}
        errors={errors}
        fileName="test.csv"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />,
    );

    expect(screen.getByText(/发现 2 条错误/)).toBeInTheDocument();
    expect(screen.getByText(/题目内容不能为空/)).toBeInTheDocument();
    expect(screen.getByText(/答案不能为空/)).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const entries: QuestionBankInsert[] = [
      { subject: '数学', content: '1+1=?', answer: '2' },
    ];

    render(
      <ImportPreview
        entries={entries}
        errors={[]}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /确认导入/ }));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const entries: QuestionBankInsert[] = [
      { subject: '数学', content: '1+1=?', answer: '2' },
    ];

    render(
      <ImportPreview
        entries={entries}
        errors={[]}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('displays file name when provided', () => {
    render(
      <ImportPreview
        entries={[{ subject: '数学', content: '1+1=?', answer: '2' }]}
        errors={[]}
        fileName="questions.json"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
      />,
    );

    expect(screen.getByText(/questions.json/)).toBeInTheDocument();
  });
});
