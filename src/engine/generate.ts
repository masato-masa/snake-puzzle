import { analyzeLevel, type LevelAnalysis } from './analyze';
import { validateLevel } from './level';
import { cloneSnakes, movedBody } from './move';
import {
  addDir,
  posKey,
  DIRS,
  type Gate,
  type Level,
  type Pos,
  type Snake,
  type Switch,
  type WarpPair,
} from './types';

export type GenerateOptions = {
  rows: number;
  cols: number;
  /** ヘビの長さ。要素数がそのまま匹数になる。 */
  snakeLengths: number[];
  wallCount?: number;
  sandCount?: number;
  warpPairCount?: number;
  /** ゲート 1 枚 + スイッチ 1 個 を 1 組として何組置くか。 */
  gateGroupCount?: number;
  /** 初期配置からランダムに何手動かした状態をゴールにするか。 */
  walkMoves?: number;
  /** 採用したい難易度の帯。 */
  minStars?: number;
  maxStars?: number;
  minMoves?: number;
  seed?: number;
};

export type GeneratedLevel = { level: Level; analysis: LevelAnalysis };

/** 再現性のある擬似乱数（seed を変えると別の盤面が出る）。 */
export const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T,>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length)];

const SNAKE_COLORS = ['#5DC94F', '#4FB8E8', '#F06CA8', '#F5A623'];

type Layout = {
  walls: Pos[];
  sands: Pos[];
  warps: WarpPair[];
  gates: Gate[];
  switches: Switch[];
  snakes: Snake[];
};

const buildLayout = (options: GenerateOptions, rng: () => number): Layout | null => {
  const { rows, cols } = options;
  const free: Pos[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free.push({ r, c });

  const used = new Set<string>();
  const take = (): Pos | null => {
    const candidates = free.filter((p) => !used.has(posKey(p)));
    if (candidates.length === 0) return null;
    const chosen = pick(candidates, rng);
    used.add(posKey(chosen));
    return chosen;
  };

  const walls: Pos[] = [];
  for (let i = 0; i < (options.wallCount ?? 0); i++) {
    const p = take();
    if (!p) return null;
    walls.push(p);
  }

  const sands: Pos[] = [];
  for (let i = 0; i < (options.sandCount ?? 0); i++) {
    const p = take();
    if (!p) return null;
    sands.push(p);
  }

  const warps: WarpPair[] = [];
  for (let i = 0; i < (options.warpPairCount ?? 0); i++) {
    const a = take();
    const b = take();
    if (!a || !b) return null;
    warps.push({ a, b });
  }

  const gates: Gate[] = [];
  const switches: Switch[] = [];
  for (let i = 0; i < (options.gateGroupCount ?? 0); i++) {
    const gate = take();
    const sw = take();
    if (!gate || !sw) return null;
    const group = String.fromCharCode(103 + i); // g, h, i...
    gates.push({ pos: gate, group });
    switches.push({ pos: sw, group });
  }

  // ヘビはランダムな自己回避ウォークで置く。ゲートとワープ穴の上からは始めない。
  const forbidden = new Set<string>([
    ...walls.map(posKey),
    ...gates.map((g) => posKey(g.pos)),
    ...warps.flatMap((w) => [posKey(w.a), posKey(w.b)]),
  ]);
  const taken = new Set<string>();

  const snakes: Snake[] = [];
  for (const [i, length] of options.snakeLengths.entries()) {
    let body: Pos[] | null = null;

    for (let attempt = 0; attempt < 60 && !body; attempt++) {
      const start = pick(free, rng);
      if (forbidden.has(posKey(start)) || taken.has(posKey(start))) continue;

      const candidate: Pos[] = [start];
      const local = new Set<string>([posKey(start)]);

      for (let n = 1; n < length; n++) {
        const options2 = DIRS.map((d) => addDir(candidate[n - 1], d)).filter((p) => {
          const key = posKey(p);
          return (
            p.r >= 0 &&
            p.r < rows &&
            p.c >= 0 &&
            p.c < cols &&
            !forbidden.has(key) &&
            !taken.has(key) &&
            !local.has(key)
          );
        });
        if (options2.length === 0) break;
        const next = pick(options2, rng);
        candidate.push(next);
        local.add(posKey(next));
      }

      if (candidate.length === length) body = candidate;
    }

    if (!body) return null;
    for (const p of body) taken.add(posKey(p));
    snakes.push({
      id: String.fromCharCode(97 + i),
      color: SNAKE_COLORS[i % SNAKE_COLORS.length],
      body,
    });
  }

  return { walls, sands, warps, gates, switches, snakes };
};

/**
 * 盤面を 1 つ作る。
 *
 * 作り方は「初期配置からランダムに数手動かし、その結果ヘビが占めているマスをゴールにする」。
 * 必ず解けること、そして「ヘビの長さ合計 = ターゲット数」が自動的に満たされる。
 * 最後に analyzeLevel にかけて、狙った難易度の帯に入るものだけ採用する。
 */
export const generateLevel = (options: GenerateOptions): GeneratedLevel | null => {
  const rng = mulberry32(options.seed ?? 1);
  const walkMoves = options.walkMoves ?? 4;
  const minStars = options.minStars ?? 1;
  const maxStars = options.maxStars ?? 5;
  const minMoves = options.minMoves ?? 2;

  for (let attempt = 0; attempt < 400; attempt++) {
    const layout = buildLayout(options, rng);
    if (!layout) continue;

    const base: Level = {
      id: 'generated',
      name: 'generated',
      rows: options.rows,
      cols: options.cols,
      walls: layout.walls,
      sands: layout.sands.length ? layout.sands : undefined,
      warps: layout.warps.length ? layout.warps : undefined,
      gates: layout.gates.length ? layout.gates : undefined,
      switches: layout.switches.length ? layout.switches : undefined,
      targets: [],
      snakes: layout.snakes,
    };

    // ランダムに動かして、たどり着いた形をゴールにする
    let snakes = cloneSnakes(layout.snakes);
    let moved = 0;
    for (let i = 0; i < walkMoves; i++) {
      const choices: { id: string; body: Pos[] }[] = [];
      for (const s of snakes) {
        for (const dir of DIRS) {
          const body = movedBody(base, snakes, s.id, dir);
          if (body) choices.push({ id: s.id, body });
        }
      }
      if (choices.length === 0) break;
      const chosen = pick(choices, rng);
      snakes = snakes.map((s) => (s.id === chosen.id ? { ...s, body: chosen.body } : s));
      moved++;
    }
    if (moved < minMoves) continue;

    const targets = snakes.flatMap((s) => s.body.map((pos) => ({ pos })));
    const startKeys = new Set(layout.snakes.flatMap((s) => s.body.map(posKey)));
    const targetKeys = targets.map((t) => posKey(t.pos));
    // 最初から満たされている盤面は却下
    if (targetKeys.every((k) => startKeys.has(k))) continue;

    const level: Level = { ...base, targets };
    if (validateLevel(level).length > 0) continue;

    const analysis = analyzeLevel(level);
    if (!analysis.solvable) continue;
    if (analysis.minMoves < minMoves) continue;
    if (analysis.stars < minStars || analysis.stars > maxStars) continue;

    return {
      level: { ...level, parMoves: analysis.minMoves, difficulty: analysis.stars },
      analysis,
    };
  }

  return null;
};

/** seed を変えながら count 個ぶん作る。 */
export const generateLevels = (count: number, options: GenerateOptions): GeneratedLevel[] => {
  const found: GeneratedLevel[] = [];
  const baseSeed = options.seed ?? 1;

  for (let i = 0; found.length < count && i < count * 40; i++) {
    const result = generateLevel({ ...options, seed: baseSeed + i * 7919 });
    if (result) found.push(result);
  }
  return found;
};
