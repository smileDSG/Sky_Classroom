import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestChecklist } from '@/components/beta/test-checklist';

describe('TestChecklist', () => {
  it('should render all categories', () => {
    render(<TestChecklist />);
    expect(screen.getByText('核心功能')).toBeTruthy();
    expect(screen.getByText('互动场景')).toBeTruthy();
    expect(screen.getByText('测验与评估')).toBeTruthy();
    expect(screen.getByText('导出与分享')).toBeTruthy();
    expect(screen.getByText('体验与性能')).toBeTruthy();
  });

  it('should show progress as 0/14 initially', () => {
    render(<TestChecklist />);
    expect(screen.getByText(/0\/14/)).toBeTruthy();
  });

  it('should expand category on click', () => {
    render(<TestChecklist />);
    fireEvent.click(screen.getByText('核心功能'));
    expect(screen.getByText('输入话题生成完整课程')).toBeTruthy();
  });

  it('should mark case as completed on click', () => {
    render(<TestChecklist />);
    fireEvent.click(screen.getByText('核心功能'));
    fireEvent.click(screen.getByText('输入话题生成完整课程'));
    expect(screen.getByText(/1\/14/)).toBeTruthy();
  });
});
