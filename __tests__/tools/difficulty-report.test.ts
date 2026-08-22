import { analyzeLevel } from '@/engine';
import { LEVELS } from '@/levels/levels';

/**
 * ステージ調整用のレポート。`npm run levels:report` で表を出す。
 * 通常の `npm test` では走らない（package.json の testPathIgnorePatterns で除外）。
 */
it('難易度の指標を一覧できる', () => {
  const rows = LEVELS.map((level) => {
    const a = analyzeLevel(level);
    return [
      level.id.padEnd(14),
      `手数 ${String(a.minMoves).padStart(2)}`,
      `分岐 ${a.branching.toFixed(2)}`,
      `読む量 ${a.searchWork.toFixed(1).padStart(4)}`,
      `最短解 ${String(a.optimalPaths).padStart(4)}`,
      `一本道 ${a.forcedRatio.toFixed(2)}`,
      `ミス致命 ${a.punishRate.toFixed(2)}`,
      `score ${a.score.toFixed(1).padStart(5)}`,
      `★${a.stars}`,
    ].join('  ');
  });

  console.log('\n' + rows.join('\n'));
  expect(rows).toHaveLength(LEVELS.length);
});
