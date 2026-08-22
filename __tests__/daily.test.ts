import { solve, validateLevel } from '@/engine';
import { buildDailyLevel, nextStreak, previousKey, todayKey } from '@/levels/daily';

describe('日付の扱い', () => {
  it('前日を求められる', () => {
    expect(previousKey('2026-08-17')).toBe('2026-08-16');
  });

  it('月をまたいでも正しい', () => {
    expect(previousKey('2026-09-01')).toBe('2026-08-31');
    expect(previousKey('2026-01-01')).toBe('2025-12-31');
  });

  it('todayKey は YYYY-MM-DD 形式', () => {
    expect(todayKey(new Date(2026, 7, 5))).toBe('2026-08-05');
  });
});

describe('連続クリア日数', () => {
  it('前日もクリアしていれば伸びる', () => {
    expect(nextStreak({ lastClearedDate: '2026-08-16', streak: 3 }, '2026-08-17')).toBe(4);
  });

  it('間が空いたら 1 に戻る', () => {
    expect(nextStreak({ lastClearedDate: '2026-08-14', streak: 9 }, '2026-08-17')).toBe(1);
  });

  it('同じ日に 2 回クリアしても増えない', () => {
    expect(nextStreak({ lastClearedDate: '2026-08-17', streak: 4 }, '2026-08-17')).toBe(4);
  });

  it('初回は 1', () => {
    expect(nextStreak({ streak: 0 }, '2026-08-17')).toBe(1);
  });
});

describe('日替わり問題', () => {
  const dates = ['2026-08-17', '2026-08-18', '2026-12-31'];

  it.each(dates)('%s の問題は定義が健全で解ける', (date) => {
    const level = buildDailyLevel(date);
    expect(level).not.toBeNull();
    if (!level) return;

    expect(validateLevel(level)).toEqual([]);
    const result = solve(level, { maxMoves: 24 });
    expect(result.solved).toBe(true);
    expect(result.minMoves).toBe(level.parMoves);
  });

  it('同じ日付なら毎回まったく同じ盤面になる', () => {
    const a = buildDailyLevel('2026-08-17');
    const b = buildDailyLevel('2026-08-17');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
