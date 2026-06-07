/**
 * tests/components/error-boundary.test.tsx
 * 测试 ErrorBoundary 组件 — 子组件抛错时边界生效
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/error-boundary';

// 故意抛错的组件
function Bomb({ msg = 'Boom!' }: { msg?: string }) {
  throw new Error(msg);
}

function SafeChild() {
  return <div>正常内容</div>;
}

describe('error-boundary — 错误边界', () => {
  it('子组件正常时，原样渲染 children', () => {
    render(
      <ErrorBoundary>
        <SafeChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('子组件抛错时，渲染 fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>自定义错误 UI</div>}>
        <Bomb />
      </ErrorBoundary>,
    );

    // fallback 内容出现了
    expect(screen.getByText('自定义错误 UI')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('没有提供 fallback 时渲染默认错误提示', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    // 默认 fallback 的 role=alert
    expect(screen.getByRole('alert')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('onError 回调在捕获错误时被调用', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Bomb msg="特定错误" />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: '特定错误' }),
      expect.any(Object),
    );

    spy.mockRestore();
  });
});
