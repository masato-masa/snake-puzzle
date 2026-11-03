import {
  analyzeLevel,
  canMove,
  createGameState,
  DIRS,
  generateLevel,
  isConnected,
  move,
  mulberry32,
  posKey,
  solve,
  type GenerateOptions,
  type Level,
  type LevelAnalysis,
} from '@/engine';
import { LEVELS, type WorldTheme } from '@/levels/levels';
import { snakeColors } from '@/theme';

/**
 * むげんモード。面の番号 n から盤面を作る（同じ n からは必ず同じ面）。
 *
 * 1. n から GenerateOptions を決める（番号が進むほど広く・長く・仕掛けが増える。
 *    どれも「確率と目標値」で寄せるだけで、「n 面からは必ず X」という境目は置かない）。
 * 2. 生成器で候補を数個作り、目標スコアに近く、退化・空手・分断の少ないものを選ぶ。
 * 3. 抜いても難しさが変わらない要素（飾り）を取り除く。
 * 4. 出なければ条件を緩めた段へ。最後の段は本編の面を出すので必ず成功する。
 */

export type EndlessSource = 'generated' | 'relaxed' | 'simple' | 'fallback';

/** 生成条件を変えたら上げる。保存してある古い面を使わず作り直すため。 */
export const ENDLESS_VERSION = 1;

export type EndlessLevel = {
  version: number;
  n: number;
  level: Level;
  theme: WorldTheme;
  source: EndlessSource;
  /** 目標にしたスコアと、実際のスコア（fallback は本編の値）。 */
  targetScore: number;
  analysis: LevelAnalysis | null;
};

export type EndlessOptions = {
  /** generateLevel の試行回数の総予算。0 にすると生成せず最終段（本編の面）を出す。 */
  attemptBudget?: number;
  /** 1 回の解析で展開する局面数の上限。超える面は採らない（端末で固まらないように）。 */
  maxStates?: number;
  /** 何個の候補から選ぶか。 */
  candidates?: number;
};

export const DEFAULT_ENDLESS_OPTIONS: Required<EndlessOptions> = {
  attemptBudget: 120,
  maxStates: 5_000,
  candidates: 3,
};

const THEMES: WorldTheme[] = ['meadow', 'desert', 'cave', 'ice', 'night'];
const COLORS = Object.values(snakeColors);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** a から b にかけて 0 → 1 へなめらかに上がる重み。 */
const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);

/** n から種を作る。近い番号でも種が散るように混ぜる。 */
export const endlessSeed = (n: number): number => {
  let h = (n * 0x9e3779b1) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** 番号が進んだ度合い（0 → 1 に漸近）。 */
const progressOf = (n: number) => 1 - Math.exp(-(n - 1) / 50);

/** 目標スコア（analyzeLevel の score）。★の境目は 28 / 50 / 70 / 90。 */
export const targetScoreFor = (n: number): number => {
  const rng = mulberry32(endlessSeed(n) ^ 0x1234);
  const base = 8 + 72 * progressOf(n);
  // ずっと右肩上がりだと疲れるので、ときどき易しい面が混ざるように揺らす
  return base * (0.75 + 0.45 * rng());
};

export const endlessThemeFor = (n: number): WorldTheme =>
  THEMES[Math.floor((n - 1) / 10) % THEMES.length];

/** 面の番号から生成条件を決める。 */
export const endlessOptionsFor = (n: number): GenerateOptions => {
  const rng = mulberry32(endlessSeed(n));
  const t = n - 1;
  const p = progressOf(n);

  // 広すぎる盤は空きマスが増えるだけで難しくならず、解析も重くなる。6x7 までにとどめる。
  const rows = clamp(Math.round(4.6 + 1.8 * p + (rng() - 0.5)), 4, 6);
  const cols = clamp(Math.round(4.6 + 2.2 * p + (rng() - 0.5)), 4, 7);
  const area = rows * cols;

  const count = clamp(Math.floor(1 + 1.3 * p + rng()), 1, 2);
  const snakeLengths: number[] = [];
  let cells = 0;
  for (let i = 0; i < count; i++) {
    const len = clamp(2 + Math.floor(rng() * (1.5 + 2.5 * p)), 2, 5);
    if (cells + len > Math.floor(area * 0.4)) break;
    snakeLengths.push(len);
    cells += len;
  }
  if (snakeLengths.length === 0) snakeLengths.push(2);

  const wallCount = Math.round(area * (0.07 + 0.05 * p + 0.06 * rng()));
  const sandCount = rng() < 0.55 * ramp(t, 5, 30) ? 1 + Math.floor(rng() * 2) : 0;
  const warpPairCount = rng() < 0.45 * ramp(t, 14, 50) ? 1 : 0;
  const gateGroupCount = rng() < 0.45 * ramp(t, 24, 60) ? 1 : 0;
  const walkMoves = Math.round(4 + 8 * p) + Math.floor(rng() * 3);
  const symmetricWalls = rng() < 0.6;

  return {
    rows,
    cols,
    snakeLengths,
    wallCount,
    sandCount,
    warpPairCount,
    gateGroupCount,
    walkMoves,
    symmetricWalls,
    minMoves: 2,
    seed: endlessSeed(n),
  };
};

/** 最短手順のうち、選ぶ余地が無かった手の割合と、退化（同じ向きの連打・1 匹だけ）の有無。 */
const shapeOf = (level: Level, maxStates: number) => {
  const result = solve(level, { maxMoves: 30, maxStates });
  if (!result.moves) return { emptyRatio: 1, degenerate: true };
  let state = createGameState(level);
  let empty = 0;
  for (const m of result.moves) {
    let choices = 0;
    for (const s of state.snakes) for (const d of DIRS) if (canMove(state, s.id, d)) choices++;
    if (choices <= 1) empty++;
    state = move(state, m.snakeId, m.dir).state;
  }
  const dirs = new Set(result.moves.map((m) => m.dir));
  const movers = new Set(result.moves.map((m) => m.snakeId));
  const degenerate =
    (result.moves.length >= 2 && dirs.size === 1) ||
    (level.snakes.length > 1 && movers.size === 1);
  return { emptyRatio: result.moves.length ? empty / result.moves.length : 1, degenerate };
};

/** 小さいほど良い候補。目標スコアからの離れ具合を主に、形の悪さを重みで足す。 */
const costOf = (level: Level, analysis: LevelAnalysis, target: number, maxStates: number) => {
  const shape = shapeOf(level, maxStates);
  return (
    Math.abs(analysis.score - target) / Math.max(8, target * 0.25) +
    (shape.degenerate ? 2 : 0) +
    4 * Math.max(0, shape.emptyRatio - 0.45) +
    (isConnected(level) ? 0 : 3)
  );
};

type Remover = { label: string; apply: (level: Level) => Level };

/** 抜いてみる要素の一覧。点対称の障害物は対ごとに抜く（まとまりを崩さないため）。 */
const removersOf = (level: Level): Remover[] => {
  const list: Remover[] = [];
  const seen = new Set<string>();
  for (const w of level.walls) {
    const key = posKey(w);
    if (seen.has(key)) continue;
    const mirror = posKey({ r: level.rows - 1 - w.r, c: level.cols - 1 - w.c });
    const group = new Set([key]);
    if (level.walls.some((x) => posKey(x) === mirror)) group.add(mirror);
    group.forEach((k) => seen.add(k));
    list.push({
      label: `wall ${[...group].join(' ')}`,
      apply: (l) => ({ ...l, walls: l.walls.filter((x) => !group.has(posKey(x))) }),
    });
  }
  for (const s of level.sands ?? []) {
    const key = posKey(s);
    list.push({
      label: `sand ${key}`,
      apply: (l) => ({ ...l, sands: (l.sands ?? []).filter((x) => posKey(x) !== key) }),
    });
  }
  (level.warps ?? []).forEach((w) => {
    const key = `${posKey(w.a)}-${posKey(w.b)}`;
    list.push({
      label: `warp ${key}`,
      apply: (l) => ({
        ...l,
        warps: (l.warps ?? []).filter((x) => `${posKey(x.a)}-${posKey(x.b)}` !== key),
      }),
    });
  });
  for (const group of new Set((level.gates ?? []).map((g) => g.group))) {
    list.push({
      label: `gate ${group}`,
      apply: (l) => ({
        ...l,
        gates: (l.gates ?? []).filter((g) => g.group !== group),
        switches: (l.switches ?? []).filter((s) => s.group !== group),
      }),
    });
  }
  return list;
};

const tidy = (level: Level): Level => ({
  ...level,
  sands: level.sands?.length ? level.sands : undefined,
  warps: level.warps?.length ? level.warps : undefined,
  gates: level.gates?.length ? level.gates : undefined,
  switches: level.switches?.length ? level.switches : undefined,
});

/** 抜いても手数が同じで、スコアもほぼ下がらない要素は飾りなので取り除く。 */
function* pruneDecorations(level: Level, analysis: LevelAnalysis, maxStates: number) {
  let current = level;
  let currentAnalysis = analysis;
  for (const remover of removersOf(level)) {
    yield;
    const variant = tidy(remover.apply(current));
    const a = analyzeLevel(variant, { maxStates });
    if (!a.solvable || a.truncated) continue;
    if (a.minMoves !== currentAnalysis.minMoves) continue;
    if (a.score < currentAnalysis.score - 1) continue;
    current = variant;
    currentAnalysis = a;
  }
  return { level: current, analysis: currentAnalysis };
}

const finish = (
  n: number,
  level: Level,
  source: EndlessSource,
  targetScore: number,
  analysis: LevelAnalysis | null,
): EndlessLevel => ({
  version: ENDLESS_VERSION,
  n,
  level: {
    ...level,
    id: `endless-${n}`,
    name: `${n} めん`,
    hint: undefined,
    audit: undefined,
    snakes: level.snakes.map((s, i) =>
      source === 'fallback' ? s : { ...s, color: COLORS[i % COLORS.length] },
    ),
    parMoves: analysis?.minMoves ?? level.parMoves,
    difficulty: analysis?.stars ?? level.difficulty,
  },
  theme: endlessThemeFor(n),
  source,
  targetScore,
  analysis,
});

/** 最終段。本編の面を出す（必ず成功する）。 */
export const fallbackFor = (n: number): EndlessLevel => {
  const base = LEVELS[(n - 1) % LEVELS.length];
  return finish(n, base, 'fallback', targetScoreFor(n), null);
};

/**
 * 生成の本体。yield ごとに一息つけるので、画面側は小分けに進めて固まらないようにできる。
 * 同期で回せば node / jest からもそのまま使える。
 */
export function* endlessSteps(
  n: number,
  options: EndlessOptions = {},
): Generator<void, EndlessLevel, void> {
  const { attemptBudget, maxStates, candidates } = { ...DEFAULT_ENDLESS_OPTIONS, ...options };
  const target = targetScoreFor(n);
  const base = endlessOptionsFor(n);
  let budget = attemptBudget;

  const relaxed: GenerateOptions = {
    ...base,
    snakeLengths: base.snakeLengths.slice(0, Math.max(1, base.snakeLengths.length - 1)),
    warpPairCount: 0,
    gateGroupCount: 0,
    walkMoves: Math.max(4, (base.walkMoves ?? 6) - 2),
  };
  const simple: GenerateOptions = {
    rows: 5,
    cols: 5,
    snakeLengths: [3],
    wallCount: 2,
    walkMoves: 5,
    minMoves: 2,
    symmetricWalls: true,
    seed: base.seed,
  };

  const rungs: { source: EndlessSource; options: GenerateOptions; share: number; want: number }[] = [
    { source: 'generated', options: base, share: 0.5, want: candidates },
    { source: 'relaxed', options: relaxed, share: 0.3, want: 1 },
    { source: 'simple', options: simple, share: 0.2, want: 1 },
  ];

  const CHUNK = 1;
  const GOOD_ENOUGH = 0.6;
  for (const rung of rungs) {
    let rungBudget = Math.floor(attemptBudget * rung.share);
    let seed = rung.options.seed ?? 1;
    let best: { level: Level; analysis: LevelAnalysis; cost: number } | null = null;
    let found = 0;

    while (found < rung.want && rungBudget > 0 && budget > 0) {
      const attempts = Math.min(CHUNK, rungBudget, budget);
      rungBudget -= attempts;
      budget -= attempts;
      yield;
      const result = generateLevel({ ...rung.options, seed, attempts, maxStates });
      seed = (seed + 7919) >>> 0;
      if (!result) continue;
      found++;
      const cost = costOf(result.level, result.analysis, target, maxStates);
      if (!best || cost < best.cost) best = { ...result, cost };
      // 十分に目標へ近ければ、残りの候補は作らない（待ち時間を減らす）
      if (best.cost < GOOD_ENOUGH) break;
    }

    if (best) {
      const pruned = yield* pruneDecorations(best.level, best.analysis, maxStates);
      return finish(n, pruned.level, rung.source, target, pruned.analysis);
    }
  }

  return fallbackFor(n);
}

/** 同期で最後まで作る（テスト・監査用）。 */
export const generateEndless = (n: number, options: EndlessOptions = {}): EndlessLevel => {
  const it = endlessSteps(n, options);
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
  }
};
