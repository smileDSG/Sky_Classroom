import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileAssistantPage from '@/app/m/sky/assistant/page';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/m/sky/assistant',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileAssistantPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it('renders a mobile vertical assistant layout with real assistant routes', () => {
    render(<MobileAssistantPage />);

    expect(screen.getByRole('heading', { name: '云翼助手' })).toBeInTheDocument();
    expect(screen.getByText('助手配置')).toBeInTheDocument();
    expect(screen.getAllByText('小镜课堂').length).toBeGreaterThan(0);
    expect(screen.getByAltText('小镜头像')).toHaveAttribute('src', '/avatars/kagami/chibi.png');
    expect(screen.getByText('提示：小镜会记住你们的对话')).toBeInTheDocument();

    const nav = screen.getByLabelText('助手导航');
    expect(within(nav).getByRole('link', { name: /与小镜交流/ })).toHaveAttribute(
      'href',
      '/m/sky/assistant?view=chat',
    );
    expect(within(nav).getByRole('link', { name: /过往对话/ })).toHaveAttribute(
      'href',
      '/m/sky/assistant?view=history',
    );
    expect(within(nav).getByRole('link', { name: /个性配置/ })).toHaveAttribute(
      'href',
      '/m/sky/assistant?view=settings',
    );
    fireEvent.click(screen.getByRole('button', { name: '高中' }));
    fireEvent.change(screen.getByPlaceholderText('输入你的问题...'), {
      target: { value: '帮我讲一下氧化还原反应' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    expect(pushMock).toHaveBeenCalledWith(
      '/m/sky/assistant?view=chat&subject=%E5%8C%96%E5%AD%A6&style=detailed&difficulty=senior&q=%E5%B8%AE%E6%88%91%E8%AE%B2%E4%B8%80%E4%B8%8B%E6%B0%A7%E5%8C%96%E8%BF%98%E5%8E%9F%E5%8F%8D%E5%BA%94',
    );

    pushMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /进入完整对话/ }));
    expect(pushMock).toHaveBeenCalledWith(
      '/m/sky/assistant?view=chat&subject=%E5%8C%96%E5%AD%A6&style=detailed&difficulty=senior&q=%E5%B8%AE%E6%88%91%E8%AE%B2%E4%B8%80%E4%B8%8B%E6%B0%A7%E5%8C%96%E8%BF%98%E5%8E%9F%E5%8F%8D%E5%BA%94',
    );
  });
});
