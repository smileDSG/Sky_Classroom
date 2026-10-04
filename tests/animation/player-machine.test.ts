import { describe, it, expect } from 'vitest';
import { initialPlayerState, reducePlayer } from '@/lib/animation/playback/player-machine';

describe('player machine', () => {
  it('idle → play → playing（第一步）', () => {
    let s = initialPlayerState(5);
    s = reducePlayer(s, { type: 'play' });
    expect(s.status).toBe('playing');
    expect(s.stepIndex).toBe(0);
  });

  it('ended 推进到下一步，最后一步结束后 finished', () => {
    let s = reducePlayer(initialPlayerState(2), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    expect(s).toMatchObject({ status: 'playing', stepIndex: 1 });
    s = reducePlayer(s, { type: 'ended' });
    expect(s).toMatchObject({ status: 'finished', stepIndex: 1 });
  });

  it('next/prev 有边界 clamp，prev 在第一步保持在 0', () => {
    let s = initialPlayerState(3);
    s = reducePlayer(s, { type: 'prev' });
    expect(s.stepIndex).toBe(0);
    s = reducePlayer(s, { type: 'next' });
    expect(s.stepIndex).toBe(1);
    s = reducePlayer(s, { type: 'next' });
    s = reducePlayer(s, { type: 'next' });
    expect(s).toMatchObject({ status: 'finished', stepIndex: 2 });
  });

  it('seek 任意步（回溯）并暂停播放', () => {
    let s = reducePlayer(initialPlayerState(5), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    s = reducePlayer(s, { type: 'ended' });
    s = reducePlayer(s, { type: 'seek', index: 0 });
    expect(s).toMatchObject({ status: 'paused', stepIndex: 0 });
  });

  it('pause/replay 与 setSpeed', () => {
    let s = reducePlayer(initialPlayerState(3), { type: 'play' });
    s = reducePlayer(s, { type: 'pause' });
    expect(s.status).toBe('paused');
    s = reducePlayer(s, { type: 'play' });
    expect(s.status).toBe('playing');
    s = reducePlayer(s, { type: 'speed', value: 1.5 });
    expect(s.speed).toBe(1.5);
  });

  it('finished 状态下 play 从头开始', () => {
    let s = reducePlayer(initialPlayerState(2), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    s = reducePlayer(s, { type: 'ended' });
    expect(s.status).toBe('finished');
    s = reducePlayer(s, { type: 'play' });
    expect(s).toMatchObject({ status: 'playing', stepIndex: 0 });
  });

  it('same-index seek 为 no-op，不打断自动播放', () => {
    let s = reducePlayer(initialPlayerState(5), { type: 'play' });
    s = reducePlayer(s, { type: 'ended' });
    expect(s).toMatchObject({ status: 'playing', stepIndex: 1 });
    s = reducePlayer(s, { type: 'seek', index: 1 });
    expect(s).toMatchObject({ status: 'playing', stepIndex: 1 });
  });

  it('seek 非法 index（NaN）被忽略', () => {
    const s = reducePlayer(initialPlayerState(3), { type: 'seek', index: Number.NaN });
    expect(s).toMatchObject({ status: 'idle', stepIndex: 0 });
  });

  it('speed 非法值（0 / NaN / Infinity）被忽略', () => {
    let s = reducePlayer(initialPlayerState(3), { type: 'speed', value: 0 });
    expect(s.speed).toBe(1);
    s = reducePlayer(s, { type: 'speed', value: Number.NaN });
    expect(s.speed).toBe(1);
    s = reducePlayer(s, { type: 'speed', value: Number.POSITIVE_INFINITY });
    expect(s.speed).toBe(1);
  });

  it('seek 越界 clamp：-5 → 0，99 → 最后一步', () => {
    let s = reducePlayer(initialPlayerState(3), { type: 'seek', index: -5 });
    expect(s.stepIndex).toBe(0);
    s = reducePlayer(s, { type: 'seek', index: 99 });
    expect(s.stepIndex).toBe(2);
  });

  it('ended 在 paused / idle 下为 no-op', () => {
    let s = reducePlayer(initialPlayerState(3), { type: 'play' });
    s = reducePlayer(s, { type: 'pause' });
    s = reducePlayer(s, { type: 'ended' });
    expect(s).toMatchObject({ status: 'paused', stepIndex: 0 });
    const idle = reducePlayer(initialPlayerState(3), { type: 'ended' });
    expect(idle.status).toBe('idle');
  });

  it('idle 下 next → 停在下一步并 paused', () => {
    const s = reducePlayer(initialPlayerState(3), { type: 'next' });
    expect(s).toMatchObject({ status: 'paused', stepIndex: 1 });
  });
});
