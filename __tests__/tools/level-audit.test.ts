import { auditLevel, findSimilarLevels } from '@/engine';
import { LEVELS } from '@/levels/levels';

/**
 * ステージ品質の監査レポート。`npm run levels:audit` で出す。
 * 通常の `npm test` では走らない。
 */
it('全ステージの品質を監査する', () => {
  const lines: string[] = [];

  for (const level of LEVELS) {
    const a = auditLevel(level);
    const head =
      `${level.id.padEnd(16)} ${String(a.minMoves).padStart(2)}手  ` +
      `中身${String(a.meaningfulMoves).padStart(2)}  ` +
      `空手率${a.emptyMoveRatio.toFixed(2)}  ` +
      `最短解${String(a.optimalPaths).padStart(3)}通り  ` +
      `密度${a.density.toFixed(2)}`;
    lines.push(a.issues.length === 0 ? `OK ${head}` : `NG ${head}`);
    for (const issue of a.issues) lines.push(`    - ${issue}`);
  }

  const similar = findSimilarLevels(LEVELS);
  lines.push('', `-- 似ている面: ${similar.length} 組 --`);
  for (const pair of similar) lines.push(`  ${pair.a} = ${pair.b}  ${pair.reason}`);

  console.log('\n' + lines.join('\n'));
  expect(LEVELS.length).toBeGreaterThan(0);
});
