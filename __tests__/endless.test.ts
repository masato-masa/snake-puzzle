import { solve, validateLevel } from '@/engine';
import { LEVELS } from '@/levels/levels';
import {
  endlessOptionsFor,
  generateEndless,
  targetScoreFor,
} from '@/levels/endless';

/**
 * むげんモード。全面を作ると遅いので、序盤と少し先だけを見る。
 * 1〜200 面の時間・分布は `node scripts/audit-endless.mjs` で測る。
 */
describe('むげんモード', () => {
  it('同じ番号からは同じ面が出る', () => {
    for (const n of [1, 7, 23]) {
      expect(JSON.stringify(generateEndless(n))).toBe(JSON.stringify(generateEndless(n)));
    }
  });

  it('番号が違えば別の面になる', () => {
    const a = generateEndless(3).level;
    const b = generateEndless(4).level;
    expect(JSON.stringify(a.snakes)).not.toBe(JSON.stringify(b.snakes));
  });

  it('1〜25 面はどれも健全で解け、parMoves が最少手数と一致する', () => {
    for (let n = 1; n <= 25; n++) {
      const { level } = generateEndless(n);
      expect(validateLevel(level)).toEqual([]);
      const result = solve(level, { maxMoves: 30, maxStates: 300_000 });
      expect(result.solved).toBe(true);
      expect(level.parMoves).toBe(result.minMoves);
      expect(level.id).toBe(`endless-${n}`);
    }
  });

  it('予算 0 でも最終段（本編の面）が出る', () => {
    for (const n of [1, 2, 150, LEVELS.length + 3]) {
      const e = generateEndless(n, { attemptBudget: 0 });
      expect(e.source).toBe('fallback');
      expect(e.level.id).toBe(`endless-${n}`);
      expect(validateLevel(e.level)).toEqual([]);
      expect(solve(e.level).solved).toBe(true);
    }
  });

  it('予算を極端に絞っても面は必ず出る', () => {
    for (const n of [5, 60, 120]) {
      const e = generateEndless(n, { attemptBudget: 3 });
      expect(validateLevel(e.level)).toEqual([]);
      expect(solve(e.level).solved).toBe(true);
    }
  });

  it('番号が進むほど、盤・ヘビ・目標スコアが大きくなる（平均で）', () => {
    const avg = (from: number, to: number, f: (n: number) => number) => {
      let sum = 0;
      for (let n = from; n <= to; n++) sum += f(n);
      return sum / (to - from + 1);
    };
    const area = (n: number) => {
      const o = endlessOptionsFor(n);
      return o.rows * o.cols;
    };
    const cells = (n: number) => endlessOptionsFor(n).snakeLengths.reduce((a, b) => a + b, 0);
    expect(avg(101, 150, area)).toBeGreaterThan(avg(1, 50, area));
    expect(avg(101, 150, cells)).toBeGreaterThan(avg(1, 50, cells));
    expect(avg(101, 150, targetScoreFor)).toBeGreaterThan(avg(1, 50, targetScoreFor));
  });
});
