import {
  addDir,
  posKey,
  type ClearRule,
  type Dir,
  type GameState,
  type Level,
  type Move,
  type MoveResult,
  type Pos,
  type Snake,
  DIRS,
} from './types';

export const cloneSnakes = (snakes: Snake[]): Snake[] =>
  snakes.map((s) => ({ ...s, body: s.body.map((p) => ({ ...p })) }));

export const createGameState = (level: Level): GameState => ({
  level,
  snakes: cloneSnakes(level.snakes),
  moves: 0,
  history: [],
});

const inBounds = (level: Level, p: Pos): boolean =>
  p.r >= 0 && p.r < level.rows && p.c >= 0 && p.c < level.cols;

/** 現在ヘビに覆われているマスの集合（キーは posKey）。 */
export const occupiedCells = (snakes: Snake[]): Set<string> => {
  const set = new Set<string>();
  for (const s of snakes) for (const b of s.body) set.add(posKey(b));
  return set;
};

/** いまヘビが乗っていて開いているゲートの group。 */
export const openGroups = (level: Level, snakes: Snake[]): Set<string> => {
  const open = new Set<string>();
  if (!level.switches?.length) return open;
  const occupied = occupiedCells(snakes);
  for (const sw of level.switches) {
    if (occupied.has(posKey(sw.pos))) open.add(sw.group);
  }
  return open;
};

/** 閉じているゲートのマス。開いているゲートはただの床として扱う。 */
export const closedGateCells = (level: Level, snakes: Snake[]): Set<string> => {
  const closed = new Set<string>();
  if (!level.gates?.length) return closed;
  const open = openGroups(level, snakes);
  for (const gate of level.gates) {
    if (!open.has(gate.group)) closed.add(posKey(gate.pos));
  }
  return closed;
};

/**
 * 動かないブロッカー（障害物・他のヘビの体）。
 * 他のヘビはこの一手の間ずっと動かないので、これは一手の最初に固定してよい。
 */
const otherBlockers = (level: Level, snakes: Snake[], snakeId: string): Set<string> => {
  const blocked = new Set<string>();
  for (const w of level.walls) blocked.add(posKey(w));
  for (const s of snakes) {
    if (s.id === snakeId) continue;
    for (const b of s.body) blocked.add(posKey(b));
  }
  return blocked;
};

/**
 * 閉じているゲートのマス。動いている本人がスイッチから外れた瞬間に、
 * そのゲートは（同じ一手の途中でも）すぐ閉じる。
 * そのため滑っている間、頭が1マス進むたびに毎回ここを計算し直す必要がある。
 */
const closedGateCellsDuringMove = (
  level: Level,
  snakes: Snake[],
  snakeId: string,
  currentBody: Pos[],
): Set<string> => {
  if (!level.gates?.length) return new Set();
  const liveSnakes = snakes.map((s) => (s.id === snakeId ? { ...s, body: currentBody } : s));
  return closedGateCells(level, liveSnakes);
};

const warpExits = (level: Level): Map<string, Pos> => {
  const map = new Map<string, Pos>();
  for (const pair of level.warps ?? []) {
    map.set(posKey(pair.a), pair.b);
    map.set(posKey(pair.b), pair.a);
  }
  return map;
};

/**
 * 頭が dir 方向に滑って通過するマスを順に返す。空配列なら無効手。
 *
 * 止まる条件:
 *   - 盤外 / 障害物 / 他のヘビ の手前
 *   - **自分の体**の手前。ただし体は頭と一緒に前へ動くので、
 *     その一歩で尻尾が抜けるマスには入れる（当たり判定も一緒に動く）
 *   - **閉じたゲート**の手前。ゲートの開閉は頭が1マス進むたびに判定し直す。
 *     自分がスイッチから外れた瞬間、同じ一手の途中でもそのゲートは閉じる
 *     （スイッチを踏んでいたヘビ自身が、離れた直後に自分のゲートへ突っ込むと止まる）
 *   - 砂マスに乗ったらその場で停止
 *   - ワープ穴に入ったら相方から出て、同じ向きに進み続ける
 *     （出口がふさがっていたら入口で停止）
 *
 * ワープが一直線に並んでいると回り続けることがある。
 * その手は進み終われないので、無効手として扱う（空配列を返す）。
 */
export const slidePath = (
  level: Level,
  snakes: Snake[],
  snakeId: string,
  dir: Dir,
): Pos[] => {
  const snake = snakes.find((s) => s.id === snakeId);
  if (!snake || snake.body.length === 0) return [];

  const blocked = otherBlockers(level, snakes, snakeId);
  const sand = new Set((level.sands ?? []).map(posKey));
  const exits = warpExits(level);

  // 真後ろ（体の次の節がある向き）への移動は、蛇の長さによらず常に無効。
  // 尻尾が抜けて他のマスには入れる当たり判定（下の selfBlocked）とは別に、
  // 最初の一歩でだけ判定する（体長 2 だと次の節＝尻尾になり、selfBlocked の
  // 「尻尾は抜けるので通れる」扱いに紛れて後ろ向きだけ通ってしまうため）。
  const rearCellKey = snake.body.length > 1 ? posKey(snake.body[1]) : null;

  const path: Pos[] = [];
  const visited = new Set<string>();
  let body = [...snake.body];

  /** いま自分の体が塞いでいるマス。尻尾は次の一歩で抜けるので数えない。 */
  const selfBlocked = () => new Set(body.slice(0, body.length - 1).map(posKey));
  /** 「今この瞬間」に閉じているゲート。頭が動くたびに呼び直す。 */
  const closedGatesNow = () => closedGateCellsDuringMove(level, snakes, snakeId, body);
  const advance = (to: Pos) => {
    body = [to, ...body].slice(0, snake.body.length);
  };

  const guard = level.rows * level.cols * 2 + 2;

  for (let step = 0; step < guard; step++) {
    const next = addDir(body[0], dir);
    const nextKey = posKey(next);
    if (!inBounds(level, next)) break;
    if (blocked.has(nextKey)) break;
    if (step === 0 && nextKey === rearCellKey) break;
    if (selfBlocked().has(nextKey)) break;
    if (closedGatesNow().has(nextKey)) break;
    // 一度通ったマスに戻ってきた ＝ 回り続ける手。止まれないので無効
    if (visited.has(nextKey)) return [];

    path.push(next);
    visited.add(nextKey);
    advance(next);

    const exit = exits.get(nextKey);
    if (exit) {
      const exitKey = posKey(exit);
      // 出口がふさがっていたら、入口のマスで止まる
      if (blocked.has(exitKey) || selfBlocked().has(exitKey) || closedGatesNow().has(exitKey))
        break;
      if (visited.has(exitKey)) return [];
      path.push(exit);
      visited.add(exitKey);
      advance(exit);
      if (sand.has(exitKey)) break;
      continue;
    }

    if (sand.has(nextKey)) break;
  }

  return path;
};

/** 進めるだけ進んだ後のヘビの体を返す。動けない場合は null。 */
export const movedBody = (
  level: Level,
  snakes: Snake[],
  snakeId: string,
  dir: Dir,
): Pos[] | null => {
  const snake = snakes.find((s) => s.id === snakeId);
  if (!snake) return null;

  const path = slidePath(level, snakes, snakeId, dir);
  if (path.length === 0) return null;

  return bodyAfterPath(snake.body, path);
};

/**
 * 頭が path を通ったあとの体。
 * 通過マスを逆順（＝新しい頭が先頭）にして旧ボディの前に連結し、長さ分だけ残す。
 * path はブロッカーを含まないので自己重複は起きない。
 */
export const bodyAfterPath = (body: Pos[], path: Pos[]): Pos[] =>
  [...path].reverse().concat(body).slice(0, body.length);

export const canMove = (state: GameState, snakeId: string, dir: Dir): boolean =>
  slidePath(state.level, state.snakes, snakeId, dir).length > 0;

/** 現在の状態から実行できる手をすべて列挙する（ソルバーとヒント用）。 */
export const legalMoves = (state: GameState): Move[] => {
  const moves: Move[] = [];
  for (const s of state.snakes) {
    for (const dir of DIRS) {
      if (canMove(state, s.id, dir)) moves.push({ snakeId: s.id, dir });
    }
  }
  return moves;
};

export const move = (state: GameState, snakeId: string, dir: Dir): MoveResult => {
  const snake = state.snakes.find((s) => s.id === snakeId);
  const path = snake ? slidePath(state.level, state.snakes, snakeId, dir) : [];
  if (!snake || path.length === 0) return { state, moved: false, path: [] };

  const body = bodyAfterPath(snake.body, path);
  const snakes = state.snakes.map((s) => (s.id === snakeId ? { ...s, body } : s));
  return {
    state: {
      ...state,
      snakes,
      moves: state.moves + 1,
      history: [...state.history, state.snakes],
    },
    moved: true,
    path,
  };
};

export const undo = (state: GameState): GameState => {
  if (state.history.length === 0) return state;
  const history = state.history.slice(0, -1);
  const snakes = state.history[state.history.length - 1];
  return { ...state, snakes, moves: Math.max(0, state.moves - 1), history };
};

export const reset = (state: GameState): GameState => createGameState(state.level);

/** 各マスを覆っているヘビの group（matchColor 用）。 */
const groupByCell = (snakes: Snake[]): Map<string, string | undefined> => {
  const map = new Map<string, string | undefined>();
  for (const s of snakes) for (const b of s.body) map.set(posKey(b), s.group);
  return map;
};

const clearCheckers: Record<ClearRule, (state: GameState) => boolean> = {
  coverAll: (state) => {
    const occupied = occupiedCells(state.snakes);
    return state.level.targets.every((t) => occupied.has(posKey(t.pos)));
  },
  matchColor: (state) => {
    const groups = groupByCell(state.snakes);
    return state.level.targets.every((t) => {
      const key = posKey(t.pos);
      if (!groups.has(key)) return false;
      return t.group === undefined || groups.get(key) === t.group;
    });
  },
};

export const isCleared = (state: GameState): boolean =>
  clearCheckers[state.level.clearRule ?? 'coverAll'](state);

/** GameState を組み立てずに判定したい探索向けの薄いラッパ。 */
export const isClearedFor = (level: Level, snakes: Snake[]): boolean =>
  isCleared({ level, snakes, moves: 0, history: [] });

/** ターゲットのうち今覆われているものの数（HUD 表示用）。 */
export const coveredTargetCount = (state: GameState): number => {
  const occupied = occupiedCells(state.snakes);
  return state.level.targets.filter((t) => occupied.has(posKey(t.pos))).length;
};
