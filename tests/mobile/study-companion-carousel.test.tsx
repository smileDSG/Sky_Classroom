import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { MobileStudyCompanionCarousel } from '@/components/mobile/home/mobile-study-companion-carousel';

describe('mobile study companion carousel', () => {
  test('switches between companion cards and refreshes fun facts', () => {
    render(
      <MobileStudyCompanionCarousel
        quote={{ text: '我思故我在。', author: '笛卡尔' }}
        facts={['第一条知识', '第二条知识']}
        initialFactIndex={0}
        tip="每天回顾昨天的内容，记忆更牢固"
      />,
    );

    const carousel = screen.getByRole('region', { name: '学习补给轮播' });
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByRole('button', { name: '查看每日一句' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: '查看趣味知识' }));

    expect(screen.getByRole('button', { name: '查看趣味知识' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByText('第一条知识')).toBeInTheDocument();
    expect(screen.getByTestId('study-companion-track')).toHaveStyle({
      transform: 'translateX(-100%)',
    });

    fireEvent.click(screen.getByRole('button', { name: '刷新趣味知识' }));

    expect(screen.getByText('第二条知识')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看学习提示' }));

    expect(screen.getByRole('button', { name: '查看学习提示' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByText('每天回顾昨天的内容，记忆更牢固')).toBeInTheDocument();
    expect(screen.getByTestId('study-companion-track')).toHaveStyle({
      transform: 'translateX(-200%)',
    });
  });
});
