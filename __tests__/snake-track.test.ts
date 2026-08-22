import { createGameState, isAdjacent, move, type Level, type Pos } from '@/engine';
import { bodyTrack, segmentCells } from '@/lib/snake-track';

const cells = (list: readonly (readonly [number, number])[]): Pos[] =>
  list.map(([r, c]) => ({ r, c }));

const asPairs = (list: Pos[]): [number, number][] => list.map((p) => [p.r, p.c]);

const level: Level = {
  id: 'track',
  name: 'track',
  rows: 5,
  cols: 5,
  walls: [],
  targets: [],
  snakes: [{ id: 'a', color: '#0f0', body: cells([[0, 2], [0, 1], [0, 0]]) }],
};

describe('胴体がたどる道すじ', () => {
  const from = level.snakes[0].body;
  const result = move(createGameState(level), 'a', 'down');
  const path = result.path;
  const track = bodyTrack(from, path);

  it('頭は経路そのものを通る', () => {
    expect(asPairs(segmentCells(track, from.length, 0, path.length))).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
    ]);
  });

  it('胴体は曲がり角を斜めに突っ切らず、頭と同じマスを順にたどる', () => {
    // 体節 1 は (0,1) から始まり、頭がいた (0,2) を経由して下りていく
    expect(asPairs(segmentCells(track, from.length, 1, path.length))).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ]);
  });

  it('どの体節も、隣り合うマスだけを 1 マスずつ進む', () => {
    for (let index = 0; index < from.length; index++) {
      const cellsOfSegment = segmentCells(track, from.length, index, path.length);
      for (let i = 1; i < cellsOfSegment.length; i++) {
        expect(isAdjacent(cellsOfSegment[i - 1], cellsOfSegment[i])).toBe(true);
      }
    }
  });

  it('出発点と到着点は移動前後の体に一致する', () => {
    const after = result.state.snakes[0].body;
    for (let index = 0; index < from.length; index++) {
      const cellsOfSegment = segmentCells(track, from.length, index, path.length);
      expect(cellsOfSegment[0]).toEqual(from[index]);
      expect(cellsOfSegment[cellsOfSegment.length - 1]).toEqual(after[index]);
    }
  });
});
