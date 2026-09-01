import { stateKey } from './level';
import { cloneSnakes, isClearedFor, movedBody } from './move';
import { solve } from './solver';
import { DIRS, type Level, type Snake } from './types';

export type LevelAnalysis = {
  solvable: boolean;
  /** 最少手数。 */
  minMoves: number;
  /** 最短解の周辺で 1 局面あたり選べる手の数。多いほど迷う。 */
  branching: number;
  /** 手数 × log2(分岐) ＝ プレイヤーが読む量の目安。 */
  searchWork: number;
  /** 最少手数で解ける手順の本数。1 なら一本道。 */
  optimalPaths: number;
  /** 最短経路上で「正解が 1 手しかない」局面の割合。 */
  forcedRatio: number;
  /** 正解から外れる手のうち、すぐには取り返せない（＝実質詰み）割合。 */
  punishRate: number;
  /** 解析に使った局面数。 */
  states: number;
  /** 総合スコア。 */
  score: number;
  /** 1〜5 の星。 */
  stars: number;
  truncated: boolean;
};

export type AnalyzeOptions = {
  /** 最少手数から何手ぶん先まで見るか。ミスの取り返しやすさをこの範囲で測る。 */
  slack?: number;
  maxStates?: number;
};

const UNSOLVABLE: LevelAnalysis = {
  solvable: false,
  minMoves: 0,
  branching: 0,
  searchWork: 0,
  optimalPaths: 0,
  forcedRatio: 0,
  punishRate: 0,
  states: 0,
  score: 0,
  stars: 1,
  truncated: false,
};

/**
 * ステージの難易度を測る。
 *
 * 盤面全体ではなく「最短解の周辺（最少手数 + slack 手まで）」だけを展開する。
 * 盤面が広いだけの易しい面が難しく出てしまうのを避けるため。
 *
 * 見ているのは 4 つ:
 *   - 何手かかるか（minMoves）
 *   - 毎回どれだけ選択肢があるか（branching）
 *   - 正解の手順がどれだけ細いか（optimalPaths / forcedRatio）
 *   - 間違えたときに取り返せるか（punishRate）
 */
export const analyzeLevel = (level: Level, options: AnalyzeOptions = {}): LevelAnalysis => {
  const slack = options.slack ?? 2;
  // solve()/auditLevel() のデフォルト（300_000）に合わせる。ここだけ小さいと、
  // 駒数の多い面で「予算内に解が見つからない」＝ UNSOLVABLE 誤判定（stars が
  // フォールバック値の 1 になり、本当に易しい面と見分けが付かない）が起きる。
  const maxStates = options.maxStates ?? 300_000;

  const solution = solve(level, { maxMoves: 30, maxStates });
  if (!solution.solved || solution.minMoves === null) return UNSOLVABLE;

  const minMoves = solution.minMoves;
  const limit = minMoves + slack;

  const start = cloneSnakes(level.snakes);
  const nodes: Snake[][] = [start];
  const depth: number[] = [0];
  const successors: number[][] = [[]];
  const index = new Map<string, number>([[stateKey(start), 0]]);
  let truncated = false;

  for (let i = 0; i < nodes.length; i++) {
    if (depth[i] >= limit) continue;
    const current = nodes[i];

    for (const snake of current) {
      for (const dir of DIRS) {
        const body = movedBody(level, current, snake.id, dir);
        if (!body) continue;

        const next = current.map((s) => (s.id === snake.id ? { ...s, body } : s));
        const key = stateKey(next);
        let target = index.get(key);

        if (target === undefined) {
          if (nodes.length >= maxStates) {
            truncated = true;
            continue;
          }
          target = nodes.length;
          index.set(key, target);
          nodes.push(next);
          depth.push(depth[i] + 1);
          successors.push([]);
        }
        successors[i].push(target);
      }
    }
  }

  const goals = nodes.map((s, i) => (isClearedFor(level, s) ? i : -1)).filter((i) => i >= 0);

  // 最短手順の本数（BFS 層に沿った数え上げ）
  const paths = new Float64Array(nodes.length);
  paths[0] = 1;
  for (let i = 0; i < nodes.length; i++) {
    if (paths[i] === 0) continue;
    for (const v of successors[i]) {
      if (depth[v] === depth[i] + 1) paths[v] += paths[i];
    }
  }
  const optimalPaths = goals
    .filter((g) => depth[g] === minMoves)
    .reduce((sum, g) => sum + paths[g], 0);

  // ゴール集合からの逆 BFS で「あと何手でクリアできるか」を出す
  const predecessors: number[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (const v of successors[i]) predecessors[v].push(i);
  }
  const toGoal = new Int32Array(nodes.length).fill(-1);
  const queue: number[] = [];
  for (const g of goals) {
    toGoal[g] = 0;
    queue.push(g);
  }
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    for (const u of predecessors[v]) {
      if (toGoal[u] !== -1) continue;
      toGoal[u] = toGoal[v] + 1;
      queue.push(u);
    }
  }

  // 最短経路上の局面だけを見て、選択肢の多さ・正解の細さ・ミスの重さを測る
  let onPath = 0;
  let forced = 0;
  let moveCount = 0;
  let badMoves = 0;
  let unrecoverable = 0;

  for (let i = 0; i < nodes.length; i++) {
    if (toGoal[i] <= 0) continue;
    if (depth[i] + toGoal[i] !== minMoves) continue;

    onPath++;
    moveCount += successors[i].length;

    let good = 0;
    for (const v of successors[i]) {
      if (toGoal[v] === toGoal[i] - 1) {
        good++;
      } else {
        badMoves++;
        // slack 手ぶん先を見てもゴールに戻れない = 実質そこで詰み
        if (toGoal[v] === -1) unrecoverable++;
      }
    }
    if (good === 1) forced++;
  }

  const branching = onPath === 0 ? 0 : moveCount / onPath;
  const forcedRatio = onPath === 0 ? 0 : forced / onPath;
  const punishRate = badMoves === 0 ? 0 : unrecoverable / badMoves;

  // 「何手ぶん、いくつの選択肢から選び続けるか」＝ 探索木の対数サイズが体感difficultyの主軸。
  // 盤面の広さそのものではなく、プレイヤーが読む量に比例する。
  const searchWork = minMoves * Math.log2(Math.max(branching, 1));

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const score =
    3.2 * searchWork +
    1.2 * minMoves +
    // 選択肢がある中での一本道だけを「難しさ」として数える
    3 * forcedRatio * clamp01(branching - 1) +
    // 短い面では「取り返せない」も起きて当然なので効きを弱める
    4 * punishRate * clamp01(minMoves / 4) -
    1.0 * Math.log2(Math.max(1, optimalPaths));

  return {
    solvable: true,
    minMoves,
    branching,
    searchWork,
    optimalPaths,
    forcedRatio,
    punishRate,
    states: nodes.length,
    score,
    stars: starsFor(score),
    truncated,
  };
};

/**
 * スコアを 1〜5 の星に丸める。しきい値は既存ステージの実測とユーザーの体感から決めている。
 * ユーザー自身が実際にプレイして「companion-block-5x4（score 17.0）と
 * wall-unlock-6x6（score 25.7）は★1、tangle-lite-6x6（score 46.4）は★2でちょうどいい」
 * と申告したため、この3点を基準に境界を引き直した：
 *   - スコア28未満はすべて★1（上の2面を含む、旧来の★2・★3の大半が繰り下がる）
 *   - スコア50未満を★2（tangle-lite-6x6 がこの帯の上限付近）
 *   - スコア70未満を★3
 *   - スコア90未満を★4（custom-1787664829861 のスコア87.9がここに入る）
 *   - それ以上を★5（tangle-dense-* / gate-tangle-6x6 などスコア100前後の最高難度）
 * 体感の数値評価は3点しかないため、28〜90の間の境界（50・70・90）は実測スコアの
 * 空白地帯を均等に区切った推定値。新しいステージでこの帯を埋めたら、また実測値で調整すること。
 */
export const starsFor = (score: number): number => {
  if (score < 28) return 1;
  if (score < 50) return 2;
  if (score < 70) return 3;
  if (score < 90) return 4;
  return 5;
};
