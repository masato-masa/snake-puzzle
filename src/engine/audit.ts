import { validateLevel } from './level';
import { canMove, createGameState, isClearedFor, move } from './move';
import { solve } from './solver';
import { posKey, DIRS, type Dir, type Level, type Move, type Pos, type Snake } from './types';

/**
 * ステージの「品質」を測る。
 *
 * 解けるかどうか（validateLevel / solve）とは別に、
 * 「その面に置いたものが本当に働いているか」を見るための道具。
 * 否定形（悪くない）ではなく、飾り・分断・遊休領域といった具体的な欠陥を名指しする。
 */
export type LevelAudit = {
  solvable: boolean;
  minMoves: number;
  /** 最短手順の本数。1 なら一本道。 */
  optimalPaths: number;
  /** 最短手順のうち「選べる手が 1 つしかない」手の割合。高いほど、ただ動かしているだけ。 */
  emptyMoveRatio: number;
  /** 選択の余地があった手の数。難度の下限としては手数より信頼できる。 */
  meaningfulMoves: number;
  /** 抜いても同じ手数で解けてしまう要素＝飾り。 */
  redundant: string[];
  /** 通行できるマスがひと続きか。分断は「別のパズルを並べただけ」。 */
  connected: boolean;
  /** 最短手順の間、一度も使われない行・列。 */
  idleRows: number[];
  idleCols: number[];
  /** 盤の広さに対する、意味のある要素の割合。 */
  density: number;
  /** 同じ向きの連打や、1 匹しか動かさないなどの退化した解。 */
  degenerate: boolean;
  /** 人が読む指摘。空なら合格。 */
  issues: string[];
};

/** 意図的に基準を外したい面は、ここに理由を書いて例外にする。 */
export type AuditWaivers = {
  /** 空手率の上限を緩める（チュートリアルなど）。 */
  allowEmptyMoveRatio?: number;
  /** 飾りを許す要素キー。 */
  allowRedundant?: string[];
  /** 退化解を許す（1 匹しかいない導入面など）。 */
  allowDegenerate?: boolean;
  /** 遊休の行・列を許す。 */
  allowIdle?: boolean;
};

export const EMPTY_MOVE_LIMIT = 0.45;

const cloneLevel = (level: Level): Level => ({ ...level });

const withoutWall = (level: Level, index: number): Level => ({
  ...cloneLevel(level),
  walls: level.walls.filter((_w, i) => i !== index),
});

const withoutSand = (level: Level, index: number): Level => ({
  ...cloneLevel(level),
  sands: (level.sands ?? []).filter((_s, i) => i !== index),
});

const withoutWarp = (level: Level, index: number): Level => ({
  ...cloneLevel(level),
  warps: (level.warps ?? []).filter((_w, i) => i !== index),
});

const withoutGateGroup = (level: Level, group: string): Level => ({
  ...cloneLevel(level),
  gates: (level.gates ?? []).filter((g) => g.group !== group),
  switches: (level.switches ?? []).filter((s) => s.group !== group),
});

/**
 * その手順を実際に再生して、通った盤面と、頭が通過したマスを返す。
 * 通過しただけのマスも「使った」とみなす（そこを通らないと解けないため）。
 */
const replay = (level: Level, moves: Move[]) => {
  let state = createGameState(level);
  const states: Snake[][] = [state.snakes];
  const passed: Pos[] = [];
  for (const m of moves) {
    const result = move(state, m.snakeId, m.dir);
    if (!result.moved) break;
    passed.push(...result.path);
    state = result.state;
    states.push(state.snakes);
  }
  return { states, passed, final: state };
};

/** 通行できるマス（障害物以外。ゲートは開くので通行可能として数える）がひと続きか。 */
const isConnected = (level: Level): boolean => {
  const blocked = new Set(level.walls.map(posKey));
  const open: Pos[] = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!blocked.has(`${r},${c}`)) open.push({ r, c });
    }
  }
  if (open.length === 0) return false;

  const seen = new Set<string>([posKey(open[0])]);
  const queue = [open[0]];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const next = { r: p.r + dr, c: p.c + dc };
      const key = posKey(next);
      if (next.r < 0 || next.r >= level.rows || next.c < 0 || next.c >= level.cols) continue;
      if (blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen.size === open.length;
};

const elementCells = (level: Level): Pos[] => [
  ...level.walls,
  ...(level.sands ?? []),
  ...(level.gates ?? []).map((g) => g.pos),
  ...(level.switches ?? []).map((s) => s.pos),
  ...(level.warps ?? []).flatMap((w) => [w.a, w.b]),
  ...level.targets.map((t) => t.pos),
];

export const auditLevel = (
  level: Level,
  overrides: AuditWaivers = {},
): LevelAudit => {
  // 例外はステージ定義に書いてあるものを既定にする
  const waivers: AuditWaivers = { ...level.audit, ...overrides };
  const issues: string[] = [];
  const definition = validateLevel(level);
  if (definition.length > 0) issues.push(...definition);

  const solution = solve(level, { maxMoves: 30, maxStates: 300_000 });
  if (!solution.solved || solution.minMoves === null || !solution.moves) {
    return {
      solvable: false,
      minMoves: 0,
      optimalPaths: 0,
      emptyMoveRatio: 0,
      meaningfulMoves: 0,
      redundant: [],
      connected: isConnected(level),
      idleRows: [],
      idleCols: [],
      density: 0,
      degenerate: false,
      issues: [...issues, '解けない'],
    };
  }

  const minMoves = solution.minMoves;

  // ── 空手率: 選ぶ余地のない手がどれだけ混ざっているか
  let state = createGameState(level);
  let emptyMoves = 0;
  for (const m of solution.moves) {
    const choices = state.snakes.flatMap((s) =>
      DIRS.filter((dir) => canMove(state, s.id, dir)).map((dir) => ({ id: s.id, dir })),
    );
    if (choices.length <= 1) emptyMoves++;
    state = move(state, m.snakeId, m.dir).state;
  }
  const emptyMoveRatio = minMoves === 0 ? 0 : emptyMoves / minMoves;
  const meaningfulMoves = minMoves - emptyMoves;

  // ── 要素の必要性
  //
  // 抜いたときに「解けなくなる」「手数が伸びる」なら、その要素は明らかに働いている。
  // 加えて「最短解の本数が増える」場合も働いている ―― 順番を強制するだけの仕掛け
  // （スイッチとゲートなど）は手数を変えないが、間違った筋を刈っているため。
  const basePaths = countOptimalPaths(level, minMoves);
  const isDecoration = (variant: Level) => {
    const result = solve(variant, { maxMoves: minMoves, maxStates: 300_000 });
    if (!result.solved || result.minMoves === null) return false;
    if (result.minMoves > minMoves) return false;
    return countOptimalPaths(variant, result.minMoves) <= basePaths;
  };

  const redundant: string[] = [];
  level.walls.forEach((w, i) => {
    if (isDecoration(withoutWall(level, i))) redundant.push(`障害物(${w.r},${w.c})`);
  });
  (level.sands ?? []).forEach((s, i) => {
    if (isDecoration(withoutSand(level, i))) redundant.push(`砂(${s.r},${s.c})`);
  });
  (level.warps ?? []).forEach((w, i) => {
    if (isDecoration(withoutWarp(level, i)))
      redundant.push(`ワープ(${w.a.r},${w.a.c})-(${w.b.r},${w.b.c})`);
  });
  for (const group of new Set((level.gates ?? []).map((g) => g.group))) {
    if (isDecoration(withoutGateGroup(level, group))) redundant.push(`ゲート"${group}"`);
  }

  // ── 遊休領域: 最短手順の間に一度も関わらない行・列
  const { states, passed } = replay(level, solution.moves);
  const touchedRows = new Set<number>();
  const touchedCols = new Set<number>();
  for (const snapshot of states) {
    for (const snake of snapshot) {
      for (const p of snake.body) {
        touchedRows.add(p.r);
        touchedCols.add(p.c);
      }
    }
  }
  for (const p of passed) {
    touchedRows.add(p.r);
    touchedCols.add(p.c);
  }

  // 最短手順の途中で「間違えて動いたら入る」マスも、誤答の置き場所として働いている
  let probe = createGameState(level);
  for (const m of solution.moves) {
    for (const snake of probe.snakes) {
      for (const dir of DIRS) {
        for (const p of move(probe, snake.id, dir).path) {
          touchedRows.add(p.r);
          touchedCols.add(p.c);
        }
      }
    }
    probe = move(probe, m.snakeId, m.dir).state;
  }
  for (const p of elementCells(level)) {
    touchedRows.add(p.r);
    touchedCols.add(p.c);
  }
  const idleRows = Array.from({ length: level.rows }, (_v, r) => r).filter(
    (r) => !touchedRows.has(r),
  );
  const idleCols = Array.from({ length: level.cols }, (_v, c) => c).filter(
    (c) => !touchedCols.has(c),
  );

  // ── 退化解: 同じ向きの連打、または複数匹いるのに 1 匹しか動かさない
  const dirs = new Set(solution.moves.map((m) => m.dir));
  const movers = new Set(solution.moves.map((m) => m.snakeId));
  const degenerate =
    (minMoves >= 2 && dirs.size === 1) || (level.snakes.length > 1 && movers.size === 1);

  const density = elementCells(level).length / (level.rows * level.cols);
  const connected = isConnected(level);

  // ── 指摘
  const emptyLimit = waivers.allowEmptyMoveRatio ?? EMPTY_MOVE_LIMIT;
  if (emptyMoveRatio > emptyLimit)
    issues.push(`空手率 ${emptyMoveRatio.toFixed(2)}（上限 ${emptyLimit}）: 盤が大きすぎる兆候`);

  const allowed = new Set(waivers.allowRedundant ?? []);
  for (const item of redundant) {
    if (!allowed.has(item)) issues.push(`飾りになっている要素: ${item}`);
  }

  if (!connected) issues.push('盤が分断されている');
  if (!waivers.allowIdle && idleRows.length > 0)
    issues.push(`使われていない行: ${idleRows.join(',')}`);
  if (!waivers.allowIdle && idleCols.length > 0)
    issues.push(`使われていない列: ${idleCols.join(',')}`);
  if (degenerate && !waivers.allowDegenerate) issues.push('退化解（同じ向きの連打 / 1匹だけで解ける）');

  return {
    solvable: true,
    minMoves,
    optimalPaths: basePaths,
    emptyMoveRatio,
    meaningfulMoves,
    redundant,
    connected,
    idleRows,
    idleCols,
    density,
    degenerate,
    issues,
  };
};

/**
 * 面どうしの似かより。
 *
 * 「盤の見た目は違うが、やっていることが同じ」を見つけるための指紋。
 * 絶対的な向きは鏡像で変わるので、直前の手から見た**曲がり方**に直して比べる。
 */
export type LevelFingerprint = {
  /** ヘビの長さ（昇順）。 */
  lengths: string;
  /** 使っている仕掛け。 */
  gimmicks: string;
  minMoves: number;
  /** 「どのヘビが」「まっすぐ／曲がる／折り返す」を並べたもの。 */
  pattern: string;
};

const turnOf = (previous: Dir | undefined, current: Dir): string => {
  if (!previous) return 'start';
  if (previous === current) return 'straight';
  const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  if (opposite[previous] === current) return 'back';
  return 'turn';
};

export const fingerprintOf = (level: Level): LevelFingerprint | null => {
  const solution = solve(level, { maxMoves: 30, maxStates: 300_000 });
  if (!solution.solved || !solution.moves || solution.minMoves === null) return null;

  const order: string[] = [];
  const lastDir = new Map<string, Dir>();
  const steps = solution.moves.map((m) => {
    if (!order.includes(m.snakeId)) order.push(m.snakeId);
    const step = `${order.indexOf(m.snakeId)}${turnOf(lastDir.get(m.snakeId), m.dir)}`;
    lastDir.set(m.snakeId, m.dir);
    return step;
  });

  const gimmicks = [
    level.walls.length > 0 ? '壁' : '',
    level.sands?.length ? '砂' : '',
    level.gates?.length ? 'ゲート' : '',
    level.warps?.length ? 'ワープ' : '',
  ]
    .filter(Boolean)
    .join('+');

  return {
    lengths: level.snakes
      .map((s) => s.body.length)
      .sort((a, b) => a - b)
      .join(','),
    gimmicks: gimmicks || 'なし',
    minMoves: solution.minMoves,
    pattern: steps.join('>'),
  };
};

/**
 * 似すぎている面の組を返す。
 * 「同じ長さのヘビ・同じ仕掛け・同じ手数・同じ曲がり方の並び」なら、盤が違っても中身は同じ。
 */
export const findSimilarLevels = (
  levels: Level[],
): { a: string; b: string; reason: string }[] => {
  const prints = levels.map((level) => ({ id: level.id, print: fingerprintOf(level) }));
  const found: { a: string; b: string; reason: string }[] = [];

  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      const a = prints[i];
      const b = prints[j];
      if (!a.print || !b.print) continue;
      if (
        a.print.lengths === b.print.lengths &&
        a.print.gimmicks === b.print.gimmicks &&
        a.print.minMoves === b.print.minMoves &&
        a.print.pattern === b.print.pattern
      ) {
        found.push({
          a: a.id,
          b: b.id,
          reason: `ヘビ[${a.print.lengths}] 仕掛け[${a.print.gimmicks}] ${a.print.minMoves}手 手順[${a.print.pattern}]`,
        });
      }
    }
  }
  return found;
};

/** 最短手数でゴールに至る手順の本数。 */
const countOptimalPaths = (level: Level, minMoves: number): number => {
  const start = level.snakes.map((s) => ({ ...s, body: [...s.body] }));
  let layer = new Map<string, { snakes: Snake[]; count: number }>();
  layer.set(key(start), { snakes: start, count: 1 });

  for (let depth = 0; depth < minMoves; depth++) {
    const next = new Map<string, { snakes: Snake[]; count: number }>();
    for (const { snakes, count } of layer.values()) {
      if (isClearedFor(level, snakes)) continue;
      const state = { level, snakes, moves: 0, history: [] };
      for (const snake of snakes) {
        for (const dir of DIRS) {
          const result = move(state, snake.id, dir);
          if (!result.moved) continue;
          const k = key(result.state.snakes);
          const found = next.get(k);
          if (found) found.count += count;
          else next.set(k, { snakes: result.state.snakes, count });
        }
      }
    }
    layer = next;
  }

  let total = 0;
  for (const { snakes, count } of layer.values()) {
    if (isClearedFor(level, snakes)) total += count;
  }
  return total;
};

const key = (snakes: Snake[]): string =>
  [...snakes]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((s) => `${s.id}:${s.body.map(posKey).join('|')}`)
    .join(';');
