/**
 * tests/store/settings-agents.test.ts
 * 测试 AI 代理（角色）设置和代理注册表
 *
 * 涉及两个 store：
 *   1. useSettingsStore — 代理选择、模式切换、数量限制
 *   2. useAgentRegistry — 代理的 CRUD 操作
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStoreMocks, clearStorage, getStore } from './mocks';

setupStoreMocks();

// ================================================================
// useSettingsStore 的代理相关部分
// ================================================================
describe('settings-agents — 代理设置', () => {
  beforeEach(async () => {
    vi.resetModules();
    clearStorage();
  });

  describe('setSelectedAgentIds', () => {
    it('选择特定的代理 ID 列表', async () => {
      const store = await getStore();
      store.getState().setSelectedAgentIds(['agent-1', 'agent-2']);
      expect(store.getState().selectedAgentIds).toEqual(['agent-1', 'agent-2']);
    });

    it('可以设为空数组', async () => {
      const store = await getStore();
      store.getState().setSelectedAgentIds([]);
      expect(store.getState().selectedAgentIds).toEqual([]);
    });
  });

  describe('setMaxTurns', () => {
    it('设置最大对话轮次', async () => {
      const store = await getStore();
      store.getState().setMaxTurns('5');
      expect(store.getState().maxTurns).toBe('5');
    });

    it('设置很大的值', async () => {
      const store = await getStore();
      store.getState().setMaxTurns('20');
      expect(store.getState().maxTurns).toBe('20');
    });
  });

  describe('setAgentMode', () => {
    it('切换到自动模式', async () => {
      const store = await getStore();
      store.getState().setAgentMode('auto');
      expect(store.getState().agentMode).toBe('auto');
    });

    it('切换回预设模式时，已选代理保留不自动清除', async () => {
      const store = await getStore();
      store.getState().setSelectedAgentIds(['agent-a']);
      store.getState().setAgentMode('auto');
      store.getState().setAgentMode('preset');

      // 切回 preset 后 selectedAgentIds 仍在
      expect(store.getState().agentMode).toBe('preset');
      expect(store.getState().selectedAgentIds).toContain('agent-a');
    });
  });

  describe('setAutoAgentCount', () => {
    it('设置自动生成的代理数量', async () => {
      const store = await getStore();
      store.getState().setAutoAgentCount(8);
      expect(store.getState().autoAgentCount).toBe(8);
    });

    it('自动模式下代理数量可设为 1', async () => {
      const store = await getStore();
      store.getState().setAutoAgentCount(1);
      expect(store.getState().autoAgentCount).toBe(1);
    });
  });
});

// ================================================================
// useAgentRegistry — 代理注册表
// ================================================================
describe('useAgentRegistry — 代理注册表', () => {
  beforeEach(() => {
    vi.resetModules();
    clearStorage();
  });

  async function getAgentStore() {
    const mod = await import('@/lib/orchestration/registry/store');
    return mod.useAgentRegistry;
  }

  it('初始化时返回 6 个默认代理', async () => {
    const store = await getAgentStore();
    const agents = store.getState().listAgents();
    expect(agents).toHaveLength(6);
  });

  it('添加自定义代理', async () => {
    const store = await getAgentStore();
    store.getState().addAgent({
      id: 'custom-student',
      name: '测试学生',
      role: 'student',
      persona: '认真好学的学生',
      color: '#ff0000',
      avatar: '🧑‍🎓',
      allowedActions: ['chat'],
      priority: 10,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // listAgents 返回数组（Object.values）
    const agents = store.getState().listAgents();
    expect(agents).toHaveLength(7);
    const found = agents.find((a) => a.id === 'custom-student');
    expect(found).toBeDefined();
    expect(found!.name).toBe('测试学生');
  });

  it('更新代理的某个字段', async () => {
    const store = await getAgentStore();
    // listAgents 返回数组，取第一个默认代理
    const allAgents = store.getState().listAgents();
    const firstAgent = allAgents[0];
    const initialName = firstAgent.name;

    store.getState().updateAgent(firstAgent.id, { color: '#00ff00' });

    const updated = store.getState().getAgent(firstAgent.id);
    expect(updated).toBeDefined();
    expect(updated!.color).toBe('#00ff00');
    expect(updated!.name).toBe(initialName);
  });

  it('删除自定义代理', async () => {
    const store = await getAgentStore();
    store.getState().addAgent({
      id: 'temp-agent',
      name: '临时代理',
      role: 'student',
      persona: '',
      color: '#000',
      avatar: '',
      isDefault: false,
      priority: 5,
      allowedActions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(store.getState().listAgents()).toHaveLength(7);

    store.getState().deleteAgent('temp-agent');
    expect(store.getState().listAgents()).toHaveLength(6);
  });

  it('删除不存在的代理不报错', async () => {
    const store = await getAgentStore();
    // 删除不存在的不应抛出异常
    expect(() => store.getState().deleteAgent('nonexistent')).not.toThrow();
  });
});
