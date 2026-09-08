import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { MobileAgentProgress } from '@/components/mobile/ui/mobile-agent-progress';
import { MobileConfidenceBadge } from '@/components/mobile/ui/mobile-confidence-badge';
import { MobileEmptyState } from '@/components/mobile/ui/mobile-empty-state';
import { MobileErrorState } from '@/components/mobile/ui/mobile-error-state';
import { MobileSourceList } from '@/components/mobile/ui/mobile-source-list';

describe('mobile shared UI', () => {
  test('empty and error states render accessible messages', () => {
    render(<MobileEmptyState title="暂无资源" description="稍后再试" />);
    expect(screen.getByText('暂无资源')).toBeInTheDocument();
    expect(screen.getByText('稍后再试')).toBeInTheDocument();

    render(<MobileErrorState title="加载失败" description="网络错误" />);
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
  });

  test('confidence badge labels review state', () => {
    const { rerender } = render(<MobileConfidenceBadge value={0.82} />);
    expect(screen.getByText(/82%/)).toBeInTheDocument();
    expect(screen.getByText(/可信/)).toBeInTheDocument();

    rerender(<MobileConfidenceBadge value={0.42} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
    expect(screen.getByText(/需复核/)).toBeInTheDocument();
  });

  test('source list renders sources', () => {
    render(
      <MobileSourceList
        sources={[
          {
            title: '人工智能导论 第一章',
            excerpt: '机器学习基础',
            href: '/source/1',
          },
        ]}
      />,
    );

    expect(screen.getByText('人工智能导论 第一章')).toBeInTheDocument();
    expect(screen.getByText('机器学习基础')).toBeInTheDocument();
  });

  test('agent progress renders stages', () => {
    render(
      <MobileAgentProgress
        stages={[
          { id: 'profile', label: '学习情况分析', status: 'done' },
          { id: 'generate', label: '资源生成', status: 'active' },
        ]}
      />,
    );

    expect(screen.getByText('学习情况分析')).toBeInTheDocument();
    expect(screen.getByText('资源生成')).toBeInTheDocument();
  });
});
