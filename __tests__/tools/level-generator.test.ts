import { generateLevels, type GenerateOptions } from '@/engine';

/**
 * ステージ量産ツール。`npm run levels:generate` で候補を出す。
 * 出てきた JSON をそのまま src/levels/levels.ts に貼れる。
 */

type Recipe = { label: string; count: number } & GenerateOptions;

const RECIPES: Recipe[] = [
  {
    label: '砂マス入り 5x5 / ★3',
    count: 2,
    rows: 5,
    cols: 5,
    snakeLengths: [3],
    wallCount: 2,
    sandCount: 2,
    walkMoves: 6,
    minMoves: 4,
    minStars: 3,
    maxStars: 3,
    seed: 20260817,
  },
  {
    label: 'ワープ入り 6x6 / ★3〜4',
    count: 2,
    rows: 6,
    cols: 6,
    snakeLengths: [4],
    wallCount: 3,
    warpPairCount: 1,
    walkMoves: 6,
    minMoves: 4,
    minStars: 3,
    maxStars: 4,
    seed: 777,
  },
  {
    label: 'ゲート入り 6x6 / ★4',
    count: 2,
    rows: 6,
    cols: 6,
    snakeLengths: [3, 2],
    wallCount: 3,
    gateGroupCount: 1,
    walkMoves: 7,
    minMoves: 5,
    minStars: 4,
    maxStars: 5,
    seed: 4242,
  },
  {
    label: '二匹 6x7 / ★4〜5',
    count: 2,
    rows: 6,
    cols: 7,
    snakeLengths: [4, 3],
    wallCount: 4,
    sandCount: 2,
    walkMoves: 8,
    minMoves: 6,
    minStars: 4,
    maxStars: 5,
    seed: 31337,
  },
];

it('ステージ候補を生成する', () => {
  for (const recipe of RECIPES) {
    const { label, count, ...options } = recipe;
    const results = generateLevels(count, options);

    console.log(`\n=== ${label} — ${results.length} 件 ===`);
    for (const { level, analysis } of results) {
      console.log(
        `★${analysis.stars}  ${analysis.minMoves}手  分岐${analysis.branching.toFixed(2)}  ` +
          `読む量${analysis.searchWork.toFixed(1)}  最短解${analysis.optimalPaths}通り  ` +
          `score${analysis.score.toFixed(1)}`,
      );
      console.log(JSON.stringify(level));
    }
  }
  expect(RECIPES.length).toBeGreaterThan(0);
});
