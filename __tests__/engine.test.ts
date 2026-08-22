import {
  analyzeLevel,
  auditLevel,
  canMove,
  createGameState,
  findSimilarLevels,
  isCleared,
  move,
  reset,
  slidePath,
  solve,
  undo,
  validateLevel,
  type Level,
  type Pos,
} from '@/engine';
import { LEVELS, WORLDS } from '@/levels/levels';

const cells = (list: readonly (readonly [number, number])[]): Pos[] =>
  list.map(([r, c]) => ({ r, c }));

const asPairs = (body: Pos[]): [number, number][] => body.map((p) => [p.r, p.c]);

/** テスト用のレベルを組み立てる。targets 未指定なら長さ合計に合わせた空でない配列を入れる。 */
const makeLevel = (partial: Partial<Level> & Pick<Level, 'rows' | 'cols' | 'snakes'>): Level => ({
  id: 'test',
  name: 'test',
  walls: [],
  targets: [],
  ...partial,
});

describe('slide movement', () => {
  // 計画書の基準例: 5x5、長さ 3 のヘビが最上段左 3 マス（頭は (0,2)）
  const base = makeLevel({
    rows: 5,
    cols: 5,
    snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 2], [0, 1], [0, 0]]) }],
    targets: cells([[4, 2], [4, 3], [4, 4]]).map((pos) => ({ pos })),
  });

  it('→ で右上 3 マス（横向き）になる', () => {
    const after = move(createGameState(base), 'a', 'right');
    expect(after.moved).toBe(true);
    expect(asPairs(after.state.snakes[0].body)).toEqual([[0, 4], [0, 3], [0, 2]]);
  });

  it('→ のあと ↓ で右端列の下 3 マス（縦向き）になる', () => {
    let state = createGameState(base);
    state = move(state, 'a', 'right').state;
    state = move(state, 'a', 'down').state;
    expect(asPairs(state.snakes[0].body)).toEqual([[4, 4], [3, 4], [2, 4]]);
    // これはターゲット（最下段の右 3 マス）とは別の場所なので未クリア
    expect(isCleared(state)).toBe(false);
  });

  it('↓ → の順なら 2 手でターゲットにぴったり収まる', () => {
    let state = createGameState(base);
    state = move(state, 'a', 'down').state;
    expect(asPairs(state.snakes[0].body)).toEqual([[4, 2], [3, 2], [2, 2]]);

    state = move(state, 'a', 'right').state;
    expect(asPairs(state.snakes[0].body)).toEqual([[4, 4], [4, 3], [4, 2]]);
    expect(isCleared(state)).toBe(true);
    expect(state.moves).toBe(2);
  });

  it('真後ろ（体のある向き）への操作は無効手で、状態も手数も変わらない', () => {
    const state = createGameState(base);
    const after = move(state, 'a', 'left'); // 体が左に伸びている
    expect(after.moved).toBe(false);
    expect(after.state).toBe(state);
    expect(after.state.moves).toBe(0);
  });

  it('当たり判定は体と一緒に動く（尻尾が抜けたマスには入れる）', () => {
    // 長さ 2 のヘビは、尻尾が抜けるので真後ろへ折り返せる
    const level = makeLevel({
      rows: 1,
      cols: 4,
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 1], [0, 0]]) }],
    });
    const after = move(createGameState(level), 'a', 'left');
    expect(after.moved).toBe(true);
    expect(asPairs(after.state.snakes[0].body)).toEqual([[0, 0], [0, 1]]);
  });

  it('通過しただけのマスは覆ったことにならない', () => {
    // 頭が (4,2) まで滑り抜けるので、途中の (2,2) は体に含まれない
    const level = makeLevel({
      rows: 5,
      cols: 5,
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 2], [0, 1]]) }],
      targets: cells([[2, 2], [3, 2]]).map((pos) => ({ pos })),
    });
    const after = move(createGameState(level), 'a', 'down');
    expect(asPairs(after.state.snakes[0].body)).toEqual([[4, 2], [3, 2]]);
    expect(isCleared(after.state)).toBe(false);
  });

  it('ワープで回り続ける手は無効になる', () => {
    // 一直線に並んだ穴。上に動くと永久に回るので、その手は成立しない
    const level = makeLevel({
      rows: 5,
      cols: 3,
      warps: [{ a: { r: 0, c: 1 }, b: { r: 4, c: 1 } }],
      snakes: [{ id: 'a', color: '#0f0', body: cells([[2, 1], [2, 0]]) }],
    });
    expect(move(createGameState(level), 'a', 'up').moved).toBe(false);
  });

  it('壁際でこれ以上進めない向きも無効手になる', () => {
    const state = createGameState(base);
    expect(move(state, 'a', 'up').moved).toBe(false);
  });

  it('障害物の手前で止まり、ヘビは曲がった形になる', () => {
    const level = makeLevel({
      rows: 5,
      cols: 5,
      walls: cells([[2, 2]]),
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 2], [0, 1], [0, 0]]) }],
    });
    const after = move(createGameState(level), 'a', 'down');
    expect(after.moved).toBe(true);
    // (1,2) までしか進めないので L 字になる
    expect(asPairs(after.state.snakes[0].body)).toEqual([[1, 2], [0, 2], [0, 1]]);
  });

  it('move は頭が通ったマスを順に返す（胴体アニメーション用）', () => {
    const after = move(createGameState(base), 'a', 'down');
    expect(after.path).toEqual(cells([[1, 2], [2, 2], [3, 2], [4, 2]]));

    // 経路の逆順を旧ボディの前に足したものが新しい体
    expect(asPairs(after.state.snakes[0].body)).toEqual([[4, 2], [3, 2], [2, 2]]);
  });

  it('動けなかったときの経路は空', () => {
    expect(move(createGameState(base), 'a', 'left').path).toEqual([]);
  });

  it('ワープをまたいだ経路も入口と出口の両方を含む', () => {
    const level = makeLevel({
      rows: 5,
      cols: 5,
      warps: [{ a: { r: 0, c: 2 }, b: { r: 4, c: 2 } }],
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [1, 0]]) }],
    });
    const after = move(createGameState(level), 'a', 'right');
    expect(after.path).toEqual(cells([[0, 1], [0, 2], [4, 2], [4, 3], [4, 4]]));
  });

  it('他のヘビの手前で止まる', () => {
    const level = makeLevel({
      rows: 5,
      cols: 5,
      snakes: [
        { id: 'a', color: '#0f0', body: cells([[0, 0], [1, 0]]) },
        { id: 'b', color: '#00f', body: cells([[0, 3], [1, 3]]) },
      ],
    });
    const state = createGameState(level);
    expect(slidePath(level, state.snakes, 'a', 'right')).toEqual(cells([[0, 1], [0, 2]]));

    const after = move(state, 'a', 'right');
    expect(asPairs(after.state.snakes[0].body)).toEqual([[0, 2], [0, 1]]);
  });

  it('動かしたヘビ以外は同じ参照のまま（不要な再描画を避ける）', () => {
    const level = makeLevel({
      rows: 4,
      cols: 4,
      snakes: [
        { id: 'a', color: '#0f0', body: cells([[0, 0], [0, 1]]) },
        { id: 'b', color: '#00f', body: cells([[3, 3], [3, 2]]) },
      ],
    });
    const state = createGameState(level);
    const after = move(state, 'b', 'up');
    expect(after.state.snakes[0]).toBe(state.snakes[0]);
    expect(after.state.snakes[1]).not.toBe(state.snakes[1]);
  });
});

describe('砂マス', () => {
  it('砂マスに乗ったらその場で止まる', () => {
    const level = makeLevel({
      rows: 5,
      cols: 5,
      sands: cells([[0, 2]]),
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [1, 0]]) }],
    });
    const after = move(createGameState(level), 'a', 'right');
    expect(after.moved).toBe(true);
    expect(asPairs(after.state.snakes[0].body)).toEqual([[0, 2], [0, 1]]);
  });
});

describe('ワープ穴', () => {
  const warpLevel = (extra?: Partial<Level>) =>
    makeLevel({
      rows: 5,
      cols: 5,
      warps: [{ a: { r: 0, c: 2 }, b: { r: 4, c: 2 } }],
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [1, 0], [2, 0], [3, 0]]) }],
      ...extra,
    });

  it('入った穴の相方から出て、同じ向きに進み続ける', () => {
    const after = move(createGameState(warpLevel()), 'a', 'right');
    expect(after.moved).toBe(true);
    // (0,1) → (0,2)[入口] → (4,2)[出口] → (4,3) → (4,4) と進み、体が穴をまたぐ
    expect(asPairs(after.state.snakes[0].body)).toEqual([[4, 4], [4, 3], [4, 2], [0, 2]]);
  });

  it('出口がふさがっていたら入口のマスで止まる', () => {
    const level = warpLevel({
      snakes: [
        { id: 'a', color: '#0f0', body: cells([[0, 0], [1, 0]]) },
        { id: 'b', color: '#00f', body: cells([[4, 2]]) },
      ],
    });
    const after = move(createGameState(level), 'a', 'right');
    expect(asPairs(after.state.snakes[0].body)).toEqual([[0, 2], [0, 1]]);
  });
});

describe('スイッチとゲート', () => {
  const gateLevel = (switchPos: [number, number]) =>
    makeLevel({
      rows: 5,
      cols: 5,
      gates: [{ pos: { r: 0, c: 2 }, group: 'g' }],
      switches: [{ pos: { r: 2, c: 0 }, group: 'g' }],
      snakes: [
        { id: 'a', color: '#0f0', body: cells([[0, 1], [0, 0]]) },
        { id: 'b', color: '#00f', body: cells([switchPos]) },
      ],
    });

  it('スイッチが押されていないゲートは壁として働く', () => {
    const state = createGameState(gateLevel([4, 4]));
    expect(canMove(state, 'a', 'right')).toBe(false);
  });

  it('スイッチにヘビが乗っている間はゲートを通れる', () => {
    const state = createGameState(gateLevel([2, 0]));
    expect(canMove(state, 'a', 'right')).toBe(true);
    const after = move(state, 'a', 'right');
    expect(asPairs(after.state.snakes[0].body)).toEqual([[0, 4], [0, 3]]);
  });

  it('ゲートに対応するスイッチが無い定義はエラーになる', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      gates: [{ pos: { r: 0, c: 2 }, group: 'g' }],
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [0, 1]]) }],
      targets: cells([[2, 0], [2, 1]]).map((pos) => ({ pos })),
    });
    expect(validateLevel(level).join()).toContain('対応するスイッチがない');
  });

  it('スイッチから離れた瞬間、同じ一手の途中でもゲートは閉じる', () => {
    const level = makeLevel({
      rows: 5,
      cols: 3,
      gates: [{ pos: { r: 0, c: 0 }, group: 'g' }],
      switches: [{ pos: { r: 2, c: 0 }, group: 'g' }],
      snakes: [{ id: 'a', color: '#0f0', body: cells([[2, 0]]) }],
    });
    const state = createGameState(level);
    // スイッチを離れた次の一歩でゲートに阻まれ、(1,0) までしか進めない
    const path = slidePath(level, state.snakes, 'a', 'up');
    expect(path).toEqual(cells([[1, 0]]));
  });

  it('スイッチはヘビの体（頭以外）が乗っていても押される', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      gates: [{ pos: { r: 0, c: 2 }, group: 'g' }],
      switches: [{ pos: { r: 2, c: 0 }, group: 'g' }],
      snakes: [
        { id: 'a', color: '#0f0', body: cells([[0, 1], [0, 0]]) },
        { id: 'b', color: '#00f', body: cells([[2, 1], [2, 0]]) },
      ],
    });
    const state = createGameState(level);
    expect(canMove(state, 'a', 'right')).toBe(true);
  });
});

describe('undo / reset', () => {
  const level = makeLevel({
    rows: 5,
    cols: 5,
    snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 2], [0, 1], [0, 0]]) }],
    targets: cells([[4, 2], [4, 3], [4, 4]]).map((pos) => ({ pos })),
  });

  it('Undo で 1 手前の配置と手数に戻る', () => {
    const start = createGameState(level);
    const moved = move(start, 'a', 'down').state;
    const back = undo(moved);
    expect(asPairs(back.snakes[0].body)).toEqual(asPairs(start.snakes[0].body));
    expect(back.moves).toBe(0);
    expect(back.history).toHaveLength(0);
  });

  it('履歴が空のときの Undo は何もしない', () => {
    const start = createGameState(level);
    expect(undo(start)).toBe(start);
  });

  it('Reset で初期配置に戻る', () => {
    let state = createGameState(level);
    state = move(state, 'a', 'down').state;
    state = move(state, 'a', 'right').state;
    const cleared = reset(state);
    expect(asPairs(cleared.snakes[0].body)).toEqual([[0, 2], [0, 1], [0, 0]]);
    expect(cleared.moves).toBe(0);
    expect(isCleared(cleared)).toBe(false);
  });
});

describe('clear rules', () => {
  it('coverAll はどのヘビが覆ってもよい', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      snakes: [
        { id: 'a', color: '#0f0', body: cells([[0, 0]]) },
        { id: 'b', color: '#00f', body: cells([[2, 2]]) },
      ],
      targets: cells([[0, 0], [2, 2]]).map((pos) => ({ pos })),
    });
    expect(isCleared(createGameState(level))).toBe(true);
  });

  it('matchColor は group が一致しないとクリアにならない', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      clearRule: 'matchColor',
      snakes: [
        { id: 'a', color: '#0f0', group: 'green', body: cells([[0, 0]]) },
        { id: 'b', color: '#00f', group: 'blue', body: cells([[2, 2]]) },
      ],
      targets: [
        { pos: { r: 0, c: 0 }, group: 'blue' },
        { pos: { r: 2, c: 2 }, group: 'blue' },
      ],
    });
    expect(isCleared(createGameState(level))).toBe(false);
  });
});

describe('validateLevel', () => {
  it('ヘビの長さ合計とターゲット数の不一致を検出する', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [0, 1]]) }],
      targets: [{ pos: { r: 2, c: 2 } }],
    });
    expect(validateLevel(level).join()).toContain('不一致');
  });

  it('体が繋がっていないヘビを検出する', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [2, 2]]) }],
      targets: cells([[2, 0], [2, 1]]).map((pos) => ({ pos })),
    });
    expect(validateLevel(level).join()).toContain('繋がっていない');
  });

  it('障害物と重なる初期配置を検出する', () => {
    const level = makeLevel({
      rows: 3,
      cols: 3,
      walls: cells([[0, 1]]),
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [0, 1]]) }],
      targets: cells([[2, 0], [2, 1]]).map((pos) => ({ pos })),
    });
    expect(validateLevel(level).join()).toContain('障害物と重なる');
  });
});

describe('solver', () => {
  it('基準例の最少手数は 2', () => {
    const level = makeLevel({
      rows: 5,
      cols: 5,
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 2], [0, 1], [0, 0]]) }],
      targets: cells([[4, 2], [4, 3], [4, 4]]).map((pos) => ({ pos })),
    });
    const result = solve(level);
    expect(result.solved).toBe(true);
    expect(result.minMoves).toBe(2);
    expect(result.moves).toEqual([
      { snakeId: 'a', dir: 'down' },
      { snakeId: 'a', dir: 'right' },
    ]);
  });

  it('解けない配置は solved=false を返す', () => {
    // 長さ 2 のヘビが 1x2 の盤に閉じ込められていて、ターゲットは届かない位置にある
    const level = makeLevel({
      rows: 1,
      cols: 3,
      walls: [],
      snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 0], [0, 1]]) }],
      targets: cells([[0, 0], [0, 2]]).map((pos) => ({ pos })),
    });
    const result = solve(level, { maxMoves: 10 });
    expect(result.solved).toBe(false);
  });
});

describe('全ステージの検証', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s は定義が健全で解ける', (_id, level) => {
    expect(validateLevel(level)).toEqual([]);

    const result = solve(level, { maxMoves: 24, maxStates: 400_000 });
    expect(result.solved).toBe(true);
    expect(result.minMoves).toBe(level.parMoves);

    // 難易度は自動計算した値と一致させておく（ステージを触ったら必ず更新する）
    expect(analyzeLevel(level).stars).toBe(level.difficulty);
  });

  // 品質監査は警告ではなくエラー扱い。例外は level.audit に理由を書いて明示する。
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s の品質監査に指摘がない', (_id, level) => {
    expect(auditLevel(level).issues).toEqual([]);
  });

  it('中身が同じ面が並んでいない', () => {
    expect(findSimilarLevels(LEVELS)).toEqual([]);
  });

  it('章に並べたステージが全部そろっている', () => {
    const listed = WORLDS.flatMap((w) => w.levelIds);
    expect([...listed].sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });

  it('ソルバーの最短手順をそのまま再生するとクリアになる', () => {
    for (const level of LEVELS) {
      const solution = solve(level, { maxMoves: 24 });
      expect(solution.solved).toBe(true);

      let state = createGameState(level);
      for (const m of solution.moves ?? []) {
        const result = move(state, m.snakeId, m.dir);
        expect(result.moved).toBe(true);
        state = result.state;
      }
      expect(isCleared(state)).toBe(true);
      expect(state.moves).toBe(level.parMoves);
    }
  });
});
