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

function chooseIdentity(label = '学习者') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
}

function chooseLearnerContext() {
  fireEvent.click(screen.getByRole('button', { name: '初中' }));
  const learningDomains = screen.getByRole('group', { name: '学习领域（选填）' });
  fireEvent.click(within(learningDomains).getByRole('button', { name: '数学' }));
  const supportDomains = screen.getByRole('group', { name: '需要重点支持的领域（选填）' });
  fireEvent.click(within(supportDomains).getByRole('button', { name: '物理' }));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
}

function chooseLearnerGoal() {
  fireEvent.click(screen.getByRole('button', { name: '巩固基础' }));
  fireEvent.click(screen.getByRole('button', { name: '分步讲解' }));
  fireEvent.change(screen.getByLabelText('最重要的问题（选填）'), {
    target: { value: '补齐代数基础' },
  });
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
      onboarding: {
        version: 2,
        status: 'completed',
        identities: ['learner'],
        primaryIdentity: 'learner',
        profiles: {},
        completedAt: 10,
      },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

describe('LearningProfileOnboarding', () => {
  it('moves through identity, learner context, and learner preference steps', () => {
    renderOnboarding();

    expect(screen.getByRole('heading', { name: '你会以哪些身份使用 OpenMAIC？' })).toBeVisible();
    chooseIdentity();
    expect(screen.getByRole('heading', { name: '你目前处于哪个学习阶段？' })).toBeVisible();
    chooseLearnerContext();
    expect(screen.getByRole('heading', { name: '你希望先解决什么？' })).toBeVisible();
    expect(screen.getByRole('group', { name: '你更喜欢怎样学习？' })).toBeVisible();
  });

  it('requires an identity and supports a separate primary identity', () => {
    renderOnboarding();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('请至少选择一个身份')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '学习者' }));
    fireEvent.click(screen.getByRole('button', { name: '教师 / 培训者' }));
    const primaryGroup = screen.getByRole('group', { name: '当前主要身份' });
    fireEvent.click(within(primaryGroup).getByRole('button', { name: '教师 / 培训者' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getByRole('heading', { name: '你主要教授哪些学习阶段？' })).toBeVisible();
  });

  it.each([
    ['家长 / 辅导者', '你主要支持哪个学习阶段？'],
    ['教育管理 / 教研者', '你服务或管理哪些学习阶段？'],
    ['其他', '哪个阶段最接近你的当前场景？'],
  ])('uses identity-specific wording for %s', (identity, heading) => {
    renderOnboarding();
    chooseIdentity(identity);
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
  });

  it('supports multiple educator stages and custom undergraduate domains', () => {
    renderOnboarding();
    chooseIdentity('教师 / 培训者');
    fireEvent.click(screen.getByRole('button', { name: '高中' }));
    fireEvent.click(screen.getByRole('button', { name: '添加教学阶段' }));

    const stageGroups = screen.getAllByRole('group', { name: /教学阶段/ });
    fireEvent.click(within(stageGroups[1]).getByRole('button', { name: '本科' }));
    const customInput = screen.getByLabelText('添加自定义领域');
    fireEvent.change(customInput, { target: { value: '量子信息' } });
    fireEvent.click(screen.getByRole('button', { name: '添加领域' }));

    expect(screen.getByRole('button', { name: '量子信息' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('button', { name: '移除该阶段' })).toHaveLength(1);
  });

  it('submits a version 2 payload and refreshes auth state', async () => {
    renderOnboarding();
    chooseIdentity();
    chooseLearnerContext();
    chooseLearnerGoal();

    fireEvent.click(screen.getByRole('button', { name: '保存画像' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(payload).toEqual({
      version: 2,
      identities: ['learner'],
      primaryIdentity: 'learner',
      profiles: {
        learner: {
          identity: 'learner',
          context: {
            stage: 'middle',
            learningDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
            supportDomains: [{ source: 'catalog', id: 'physics', name: '物理' }],
          },
          goals: [{ source: 'catalog', id: 'build-foundations', label: '巩固基础' }],
          roleNeeds: [],
          preferences: { explanationStyle: 'step-by-step' },
          detail: '补齐代数基础',
        },
      },
    });
    expect(screen.getByRole('heading', { name: '用户画像已保存' })).toBeVisible();
  });

  it('keeps every answer when save fails and permits retry', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }, 500));
    renderOnboarding();
    chooseIdentity();
    chooseLearnerContext();
    chooseLearnerGoal();

    fireEvent.click(screen.getByRole('button', { name: '保存画像' }));

    expect(await screen.findByText('保存失败，请稍后重试')).toBeVisible();
    expect(screen.getByLabelText('最重要的问题（选填）')).toHaveValue('补齐代数基础');
    expect(screen.getByRole('button', { name: '保存画像' })).toBeEnabled();
  });

  it('loads an existing v2 profile in edit mode and does not overwrite it on exit', async () => {
    navigation.search = 'mode=edit&redirect=%2Faccount';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        status: 'completed',
        onboarding: {
          version: 2,
          status: 'completed',
          identities: ['educator'],
          primaryIdentity: 'educator',
          profiles: {
            educator: {
              identity: 'educator',
              contexts: [
                {
                  stage: 'high',
                  teachingDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
                },
              ],
              goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
              roleNeeds: [],
              preferences: { primarySupport: 'balanced' },
              completedAt: 100,
            },
          },
          completedAt: 100,
        },
      }),
    );
    renderOnboarding();

    expect(screen.getByText('正在读取用户画像…')).toBeVisible();
    expect(await screen.findByRole('heading', { name: '更新用户画像' })).toBeVisible();
    expect(screen.getByRole('button', { name: '教师 / 培训者' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(navigation.push).toHaveBeenCalledWith('/account');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('records skip for first onboarding and returns to the safe redirect', async () => {
    navigation.search = 'redirect=%2Fsky%2Flearning';
    renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: '暂时跳过' }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/sky/learning'));
    expect(fetchMock).toHaveBeenCalledWith('/api/user/learning-onboarding/skip', {
      method: 'POST',
    });
  });
});
