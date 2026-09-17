import { describe, expect, it } from 'vitest';
import {
  extractCompleteCardsFromBuffer,
  limitDeckCards,
  parseMemoryCardsDeck,
} from '@/lib/agents/cloud-mind/memory-cards-agent';

function cardJson(index: number, front = `问题${index}`, back = `答案${index}`): string {
  return JSON.stringify({
    index,
    front,
    back,
    relatedConcepts: [`概念${index}`],
    difficulty: 'medium',
    tags: [`标签${index}`],
  });
}

describe('extractCompleteCardsFromBuffer', () => {
  it('returns nothing for an empty buffer', () => {
    expect(extractCompleteCardsFromBuffer('')).toEqual([]);
  });

  it('returns nothing when the cards marker has not appeared yet', () => {
    expect(extractCompleteCardsFromBuffer('{"topic":"函数","description":"')).toEqual([]);
  });

  it('returns nothing when the marker exists but the array has not opened', () => {
    expect(extractCompleteCardsFromBuffer('{"cards": ')).toEqual([]);
  });

  it('returns nothing while the first card object is still unclosed', () => {
    const buffer = `{"cards": [${cardJson(1).slice(0, -2)}`;
    expect(extractCompleteCardsFromBuffer(buffer)).toEqual([]);
  });

  it('extracts a single complete card', () => {
    const buffer = `{"topic":"函数","cards": [${cardJson(1)}]}`;
    const cards = extractCompleteCardsFromBuffer(buffer);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ index: 1, front: '问题1', back: '答案1' });
  });

  it('extracts complete cards and leaves trailing partial card for the next chunk', () => {
    const buffer = `{"topic":"函数","cards": [${cardJson(1)}, ${cardJson(2)}, ${cardJson(3).slice(0, -1)}`;
    const cards = extractCompleteCardsFromBuffer(buffer);
    expect(cards.map((item) => item.index)).toEqual([1, 2]);
  });

  it('keeps extracting more cards as the buffer grows chunk by chunk', () => {
    const full = `{"topic":"函数","cards": [${cardJson(1)}, ${cardJson(2)}, ${cardJson(3)}]}`;
    const firstCards = extractCompleteCardsFromBuffer(full.slice(0, 60));
    const secondCards = extractCompleteCardsFromBuffer(full.slice(0, 120));
    const allCards = extractCompleteCardsFromBuffer(full);
    expect(firstCards.length).toBeLessThanOrEqual(secondCards.length);
    expect(secondCards.length).toBeLessThanOrEqual(allCards.length);
    expect(allCards).toHaveLength(3);
  });

  it('handles escaped quotes and LaTeX backslashes inside card strings', () => {
    const buffer = `{"cards": [${cardJson(
      1,
      '顶点式是 $y=a(x-h)^2+k$，\\textbf{注意}转义',
      '答案为 $\\frac{1}{3}$，含"引号"和\\\\反斜杠',
    )}]}`;
    const cards = extractCompleteCardsFromBuffer(buffer);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toContain('\\textbf{注意}');
    expect(cards[0].back).toContain('\\frac{1}{3}');
    expect(cards[0].back).toContain('"引号"');
  });

  it('stops at a complete object that is not a valid card (no front/back)', () => {
    const buffer = `{"cards": [${cardJson(1)}, {"index": 2, "front": "only-front"}]}`;
    const cards = extractCompleteCardsFromBuffer(buffer);
    expect(cards.map((item) => item.index)).toEqual([1]);
  });
});

describe('limitDeckCards', () => {
  function deck(count: number) {
    return {
      topic: '函数',
      description: '',
      cards: Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        front: `问题${i + 1}`,
        back: `答案${i + 1}`,
        relatedConcepts: [],
        difficulty: 'medium',
        tags: [],
      })),
    };
  }

  it('truncates a deck that exceeds the requested card count', () => {
    const limited = limitDeckCards(deck(21) as never, 6) as unknown as ReturnType<typeof deck>;
    expect(limited.cards).toHaveLength(6);
    expect(limited.cards[0].front).toBe('问题1');
    expect(limited.cards[5].front).toBe('问题6');
  });

  it('keeps the deck unchanged when it already fits the budget', () => {
    const d = deck(5) as never;
    expect(limitDeckCards(d, 6)).toBe(d);
  });

  it('keeps the deck unchanged when cardCount is undefined or zero', () => {
    const d = deck(21) as never;
    expect(limitDeckCards(d, undefined)).toBe(d);
    expect(limitDeckCards(d, 0)).toBe(d);
  });
});

describe('parseMemoryCardsDeck', () => {
  it('parses a fenced JSON deck', () => {
    const deck = parseMemoryCardsDeck(
      '```json\n' +
        JSON.stringify({
          topic: '函数',
          description: '函数卡组',
          cards: [
            { index: 1, front: 'f', back: 'b', relatedConcepts: [], difficulty: 'easy', tags: [] },
          ],
          studyTips: '先理解',
          reviewIntervals: [1, 2, 4],
        }) +
        '\n```',
    );
    expect(deck?.topic).toBe('函数');
    expect(deck?.cards).toHaveLength(1);
  });

  it('rejects malformed responses', () => {
    expect(parseMemoryCardsDeck('not json at all')).toBeNull();
    expect(parseMemoryCardsDeck('{"topic":"函数"}')).toBeNull();
  });
});
