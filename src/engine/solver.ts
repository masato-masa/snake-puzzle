import { stateKey } from './level';
import { cloneSnakes, isClearedFor, movedBody } from './move';
import { DIRS, type Level, type Move, type Snake } from './types';

export type SolveOptions = {
  /** この手数を超える解は探さない。 */
  maxMoves?: number;
  /** 展開する状態数の上限（安全弁）。 */
  maxStates?: number;
};

export type SolveResult = {
  solved: boolean;
  /** 最少手数。solved が false なら null。 */
  minMoves: number | null;
  /** 最短手順。solved が false なら null。 */
  moves: Move[] | null;
  /** 展開した状態数。 */
  visited: number;
  /** 上限に達して打ち切った場合 true（＝「解なし」と断定できない）。 */
  exhausted: boolean;
};

type Node = {
  snakes: Snake[];
  parent: number;
  move: Move | null;
  depth: number;
};

const reconstruct = (nodes: Node[], index: number): Move[] => {
  const moves: Move[] = [];
  for (let i = index; i > 0; i = nodes[i].parent) {
    const m = nodes[i].move;
    if (m) moves.push(m);
  }
  return moves.reverse();
};

/**
 * 幅優先探索で最少手数の解を求める。
 * 1 手 = (ヘビ, 方向) の組で、1 マスも動けない手は展開しない。
 * ステージ定義が解けることの検証と parMoves の自動算出に使う。
 */
export const solve = (level: Level, options: SolveOptions = {}): SolveResult => {
  const maxMoves = options.maxMoves ?? 30;
  const maxStates = options.maxStates ?? 300_000;

  const nodes: Node[] = [
    { snakes: cloneSnakes(level.snakes), parent: -1, move: null, depth: 0 },
  ];
  const seen = new Set<string>([stateKey(nodes[0].snakes)]);
  let exhausted = false;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (isClearedFor(level, node.snakes)) {
      return {
        solved: true,
        minMoves: node.depth,
        moves: reconstruct(nodes, i),
        visited: nodes.length,
        exhausted: false,
      };
    }

    if (node.depth >= maxMoves) {
      exhausted = true;
      continue;
    }

    for (const snake of node.snakes) {
      for (const dir of DIRS) {
        const body = movedBody(level, node.snakes, snake.id, dir);
        if (!body) continue;

        const next = node.snakes.map((s) => (s.id === snake.id ? { ...s, body } : s));
        const key = stateKey(next);
        if (seen.has(key)) continue;
        seen.add(key);

        nodes.push({
          snakes: next,
          parent: i,
          move: { snakeId: snake.id, dir },
          depth: node.depth + 1,
        });

        if (nodes.length >= maxStates) {
          return {
            solved: false,
            minMoves: null,
            moves: null,
            visited: nodes.length,
            exhausted: true,
          };
        }
      }
    }
  }

  return { solved: false, minMoves: null, moves: null, visited: nodes.length, exhausted };
};
