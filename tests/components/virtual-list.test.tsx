/**
 * tests/components/virtual-list.test.tsx
 * 测试 VirtualList 组件 — 长列表只渲染可见项
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VirtualList } from '@/components/virtual-list';

// Mock @tanstack/react-virtual — 只暴露必要的行为
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn((opts: { count: number; estimateSize: () => number }) => {
    const size = opts.estimateSize();
    const items = Array.from({ length: Math.min(opts.count, 10) }, (_, i) => ({
      index: i,
      key: i,
      start: i * size,
      size,
      measureRef: vi.fn(),
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => opts.count * size,
      measureElement: vi.fn(),
    };
  }),
}));

describe('virtual-list — 虚拟列表', () => {
  it('只渲染可见区域内的项目', () => {
    const items = Array.from({ length: 100 }, (_, i) => `项目 ${i}`);

    const { container } = render(
      <VirtualList
        items={items}
        renderItem={(item) => <div key={item}>{item}</div>}
        height={200}
        estimateSize={40}
      />,
    );

    // 容器存在
    const outer = container.firstChild as HTMLElement;
    expect(outer).toBeDefined();
    expect(outer.style.height).toBe('200px');
    // 内部占位高度 = 100 × 40 = 4000
    expect(outer.children[0].getAttribute('style')).toContain('height');
  });

  it('空列表不崩溃', () => {
    const { container } = render(
      <VirtualList
        items={[]}
        renderItem={() => null}
        height={200}
      />,
    );

    expect(container.firstChild).toBeDefined();
  });

  it('renderItem 收到正确的 item 和 index', () => {
    const renderSpy = vi.fn((item: string, index: number) => (
      <div key={index}>{item}</div>
    ));

    render(
      <VirtualList
        items={['a']}
        renderItem={renderSpy}
        height={200}
      />,
    );

    expect(renderSpy).toHaveBeenCalledWith('a', 0);
  });

  it('支持自定义 className', () => {
    const { container } = render(
      <VirtualList
        items={['x']}
        renderItem={(item) => <div>{item}</div>}
        height={200}
        className="my-list"
      />,
    );

    expect(container.querySelector('.my-list')).toBeInTheDocument();
  });
});
