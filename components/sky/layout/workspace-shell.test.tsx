import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkspacePrimaryAction, WorkspaceShell } from './workspace-shell';

describe('WorkspaceShell', () => {
  it('renders the header, ordered workspace slots, and one primary action', () => {
    render(
      <WorkspaceShell
        title="AI 出题试炼"
        description="生成一组适合当前学习目标的练习题"
        panel={<div data-testid="panel">参数</div>}
        main={<div data-testid="main">任务</div>}
        aside={<div data-testid="aside">预览</div>}
        actions={<WorkspacePrimaryAction>开始出题</WorkspacePrimaryAction>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'AI 出题试炼' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace-grid')).toHaveAttribute('data-mode', 'edit');
    expect(
      screen.getAllByTestId(/^(panel|main|aside)$/).map((node) => node.dataset.testid),
    ).toEqual(['panel', 'main', 'aside']);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '开始出题' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '开始出题' })).toHaveAttribute(
      'data-primary',
      'true',
    );
  });

  it('keeps the same slot order and marks run mode on the grid', () => {
    render(
      <WorkspaceShell
        mode="run"
        title="智能授课"
        description="进行实时课堂讲解"
        status={<span>进行中</span>}
        panel={<div data-testid="panel" />}
        main={<div data-testid="main" />}
        aside={<div data-testid="aside" />}
        actions={<WorkspacePrimaryAction>暂停授课</WorkspacePrimaryAction>}
      />,
    );

    expect(screen.getByTestId('workspace-grid')).toHaveAttribute('data-mode', 'run');
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(
      screen.getAllByTestId(/^(panel|main|aside)$/).map((node) => node.dataset.testid),
    ).toEqual(['panel', 'main', 'aside']);
  });
});
