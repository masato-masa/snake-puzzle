import type { Pos } from '@/engine';

/**
 * ヘビが通る道すじ全体。
 * 「旧尻尾 → … → 旧頭 → 頭が通ったマス…」の順に並べる。
 *
 * 各体節はこの並びの上を、頭が進んだマス数だけ前へ移動する。
 * こうすると胴体は必ず頭と同じ道を通り、曲がり角を斜めに突っ切らない。
 */
export const bodyTrack = (from: Pos[], path: Pos[]): Pos[] =>
  [...from].reverse().concat(path);

/**
 * 体節 index が通るマスを、時間順に返す。
 * 先頭が移動前の位置、末尾が移動後の位置で、間はすべて実際に通るマス。
 */
export const segmentCells = (
  track: Pos[],
  bodyLength: number,
  index: number,
  steps: number,
): Pos[] => {
  const start = bodyLength - 1 - index;
  const cells: Pos[] = [];
  for (let step = 0; step <= steps; step++) {
    const cell = track[start + step];
    if (!cell) break;
    cells.push(cell);
  }
  return cells;
};
