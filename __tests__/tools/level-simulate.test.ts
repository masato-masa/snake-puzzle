import { createGameState, move, type Dir, type Level, type Pos } from '@/engine';

/**
 * 設計用シミュレーター。`npm run levels:simulate` で使う。
 * 初期配置と手順を与えて、実際に動かした結果（各ヘビの最終位置）を出力する。
 * 手計算で座標を求めるより確実なので、新ステージの終形を決めるときに使う。
 *
 * 使い方: SCENARIOS に案を足して実行 → 出力された最終位置をそのまま
 * level-draft.test.ts の targets に転記する。使い終わったら空にしておく。
 */

const cells = (list: readonly (readonly [number, number])[]): Pos[] =>
  list.map(([r, c]) => ({ r, c }));
const snake = (id: string, body: readonly (readonly [number, number])[]) => ({
  id,
  color: '#5DC94F',
  body: cells(body),
});
const gate = (r: number, c: number, group = 'g') => ({ pos: { r, c }, group });
const toggle = (r: number, c: number, group = 'g') => ({ pos: { r, c }, group });
const warp = (a: readonly [number, number], b: readonly [number, number]) => ({
  a: { r: a[0], c: a[1] },
  b: { r: b[0], c: b[1] },
});

type Scenario = {
  label: string;
  level: Level;
  moves: { snakeId: string; dir: Dir }[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _helpers = { cells, snake, gate, toggle, warp };

const SCENARIOS: Scenario[] = [];

it('シナリオを再生して最終形を出す', () => {
  const lines: string[] = [];

  for (const { label, level, moves } of SCENARIOS) {
    let state = createGameState(level);
    lines.push(`\n== ${label} ==`);
    lines.push(
      `初期: ${state.snakes.map((s) => `${s.id}=[${s.body.map((p) => `(${p.r},${p.c})`).join(',')}]`).join(' ')}`,
    );

    for (const m of moves) {
      const result = move(state, m.snakeId, m.dir);
      if (!result.moved) {
        lines.push(`  ${m.snakeId}:${m.dir} -> 無効手（動けない）`);
        continue;
      }
      state = result.state;
      const snake = state.snakes.find((s) => s.id === m.snakeId)!;
      lines.push(
        `  ${m.snakeId}:${m.dir} -> [${snake.body.map((p) => `(${p.r},${p.c})`).join(',')}]  path=[${result.path.map((p) => `(${p.r},${p.c})`).join(',')}]`,
      );
    }

    lines.push(
      `最終: ${state.snakes.map((s) => `${s.id}=[${s.body.map((p) => `(${p.r},${p.c})`).join(',')}]`).join(' ')}`,
    );
  }

  if (lines.length > 0) console.log(lines.join('\n'));
  expect(SCENARIOS.length).toBeGreaterThanOrEqual(0);
});
