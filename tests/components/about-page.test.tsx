import { render, screen } from '@testing-library/react';
import AboutPage from '@/app/about/page';

describe('AboutPage', () => {
  test('shows Sky Classroom project and open-source license information', () => {
    render(<AboutPage />);

    expect(screen.getByRole('heading', { name: /关于天空课堂/i })).toBeInTheDocument();
    expect(screen.getByText(/AI 多智能体互动课堂平台/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /查看开源协议/ })).toHaveAttribute(
      'href',
      'https://github.com/ikun1111111111/OpenMAIC-firsted-team-/blob/main/LICENSE',
    );
  });
});
