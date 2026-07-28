import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const navigation = vi.hoisted(() => ({
  search: 'redirect=%2Fsky',
  push: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ refresh }),
}));

import { LearningProfileOnboarding } from '@/components/sky/onboarding/learning-profile-onboarding';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderOnboarding() {
  return render(<LearningProfileOnboarding />);
}

function chooseEducation() {
  fireEvent.click(screen.getByRole('button', { name: '初中' }));
  fireEvent.click(screen.getByRole('button', { name: '初二' }));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
}

function chooseSubjects(favorites = ['数学'], weak = ['数学']) {
  const favoriteGroup = screen.getByRole('group', { name: '感兴趣的学科' });
  const weakGroup = screen.getByRole('group', { name: '目前较吃力的学科' });
  for (const label of favorites) {
    fireEvent.click(within(favoriteGroup).getByRole('button', { name: label }));
  }
  for (const label of weak) {
    fireEvent.click(within(weakGroup).getByRole('button', { name: label }));
  }
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
}

function chooseGoal() {
  fireEvent.click(screen.getByRole('button', { name: '补齐基础' }));
  fireEvent.change(screen.getByLabelText('具体目标（选填）'), {
    target: { value: '补齐代数基础' },
  });
  fireEvent.click(screen.getByRole('button', { name: '分步推导' }));
}

beforeEach(() => {
  navigation.search = 'redirect=%2Fsky';
  navigation.push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    jsonResponse({
      success: true,
      status: 'completed',
      onboarding: { version: 1, status: 'completed' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

describe('LearningProfileOnboarding', () => {
  it('moves through education, subjects, and goal steps', () => {
    renderOnboarding();

    expect(screen.getByRole('heading', { name: '你目前在哪个学习阶段？' })).toBeInTheDocument();
    chooseEducation();
    expect(screen.getByRole('group', { name: '感兴趣的学科' })).toBeInTheDocument();
    chooseSubjects([], []);
    expect(screen.getByRole('heading', { name: '这段时间最想达成什么？' })).toBeInTheDocument();
  });

  it('requires stage and grade before continuing', () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('请选择学习阶段和年级')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '初中' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('请选择学习阶段和年级')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '初二' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('group', { name: '感兴趣的学科' })).toBeInTheDocument();
  });

  it('allows favorite and weak subject selections to overlap', () => {
    renderOnboarding();
    chooseEducation();

    const favoriteMath = within(screen.getByRole('group', { name: '感兴趣的学科' })).getByRole(
      'button',
      { name: '数学' },
    );
    const weakMath = within(screen.getByRole('group', { name: '目前较吃力的学科' })).getByRole(
      'button',
      { name: '数学' },
    );
    fireEvent.click(favoriteMath);
    fireEvent.click(weakMath);

    expect(favoriteMath).toHaveAttribute('aria-pressed', 'true');
    expect(weakMath).toHaveAttribute('aria-pressed', 'true');
  });

  it('submits one complete payload and refreshes auth state', async () => {
    renderOnboarding();
    chooseEducation();
    chooseSubjects(['数学', '物理'], ['数学']);
    chooseGoal();

    fireEvent.click(screen.getByRole('button', { name: '保存画像' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/user/learning-onboarding',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual({
      educationLevel: 'middle',
      grade: '初二',
      favoriteSubjects: ['math', 'physics'],
      weakSubjects: ['math'],
      learningGoal: 'build-foundations',
      goalDetail: '补齐代数基础',
      teachingPreference: 'step-by-step',
    });
    expect(screen.getByRole('heading', { name: '学习画像已保存' })).toBeInTheDocument();
  });

  it('keeps answers and shows an error when save fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }, 500));
    renderOnboarding();
    chooseEducation();
    chooseSubjects();
    chooseGoal();

    fireEvent.click(screen.getByRole('button', { name: '保存画像' }));

    expect(await screen.findByText('保存失败，请稍后重试')).toBeInTheDocument();
    expect(screen.getByLabelText('具体目标（选填）')).toHaveValue('补齐代数基础');
    expect(screen.getByRole('button', { name: '保存画像' })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('records skip and returns to the safe redirect', async () => {
    navigation.search = 'redirect=%2Fsky%2Flearning';
    renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: '暂时跳过' }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/sky/learning'));
    expect(fetchMock).toHaveBeenCalledWith('/api/user/learning-onboarding/skip', {
      method: 'POST',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('offers a diagnostic prefilled with the first weak subject', async () => {
    renderOnboarding();
    chooseEducation();
    chooseSubjects([], ['物理', '数学']);
    chooseGoal();
    fireEvent.click(screen.getByRole('button', { name: '保存画像' }));
    await screen.findByRole('heading', { name: '学习画像已保存' });

    fireEvent.click(screen.getByRole('button', { name: '开始诊断' }));

    expect(navigation.push).toHaveBeenCalledWith(
      '/sky/cloud-mind/quiz?subject=physics&mode=diagnostic',
    );
  });

  it('loads and prefills the existing profile in edit mode', async () => {
    navigation.search = 'mode=edit&redirect=%2Faccount';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        status: 'completed',
        educationLevel: 'high',
        grade: '高二',
        favoriteSubjects: ['english'],
        onboarding: {
          version: 1,
          status: 'completed',
          weakSubjects: ['physics'],
          learningGoal: 'exam-prep',
          goalDetail: '准备期末考试',
          teachingPreference: 'visual-explanation',
          completedAt: 100,
        },
      }),
    );

    renderOnboarding();

    expect(screen.getByText('正在读取学习画像…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '更新学习画像' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '高中' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '高二' })).toHaveAttribute('aria-pressed', 'true');
    expect(fetchMock).toHaveBeenCalledWith('/api/user/learning-onboarding');
  });
});
