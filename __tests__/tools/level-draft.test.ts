import {
  analyzeLevel,
  auditLevel,
  findSimilarLevels,
  solve,
  type Level,
  type Pos,
  type Target,
} from '@/engine';
import { LEVELS } from '@/levels/levels';

const cells = (list: readonly (readonly [number, number])[]): Pos[] =>
  list.map(([r, c]) => ({ r, c }));
const targets = (list: readonly (readonly [number, number])[]): Target[] =>
  list.map(([r, c]) => ({ pos: { r, c } }));
const snake = (
  id: string,
  color: string,
  body: readonly (readonly [number, number])[],
) => ({ id, color, body: cells(body) });

const GREEN = '#5DC94F';
const SKY = '#4FB8E8';
const PINK = '#F06CA8';

function gate(r: number, c: number, group: string) {
  return { pos: { r, c }, group };
}
function toggle(r: number, c: number, group: string) {
  return { pos: { r, c }, group };
}
function warp(a: readonly [number, number], b: readonly [number, number]) {
  return { a: { r: a[0], c: a[1] }, b: { r: b[0], c: b[1] } };
}

const AMBER = '#F5A623';

const DRAFTS: { world: string; question: string; level: Level }[] = [];

it('新ステージ案を監査する', () => {
  const lines: string[] = [];
  const allNew = DRAFTS.map((d) => d.level);
  // findSimilarLevels は渡された配列全体のフィンガープリント（内部でsolve()を使う）を
  // 毎回計算し直すため、候補ごとにループ内で呼ぶと候補数×(既存+候補)回のsolve()が走って
  // 極端に遅くなる。ループの外で1回だけ計算し、結果を使い回す。
  const allDupPairs = findSimilarLevels([...LEVELS, ...allNew]);

  for (const { world, question, level } of DRAFTS) {
    const solution = solve(level, { maxMoves: 24 });
    if (!solution.solved) {
      lines.push(`x [${world}] ${level.id.padEnd(24)} 解けない  -- ${question}`);
      continue;
    }

    const audit = auditLevel(level);
    const analysis = analyzeLevel(level);
    const dup = allDupPairs.filter((p) => p.a === level.id || p.b === level.id);
    const head =
      `[${world}] ${level.id.padEnd(24)} ${audit.minMoves}手  中身${audit.meaningfulMoves}  ` +
      `空手率${audit.emptyMoveRatio.toFixed(2)}  最短解${audit.optimalPaths}通り  ★${analysis.stars}`;
    const ok = audit.issues.length === 0 && dup.length === 0;
    lines.push(`${ok ? 'OK' : 'NG'} ${head}  -- ${question}`);
    lines.push(`    手順: ${solution.moves?.map((m) => `${m.snakeId}:${m.dir}`).join(' -> ')}`);
    for (const issue of audit.issues) lines.push(`    - ${issue}`);
    for (const d of dup) lines.push(`    - 重複: ${d.a} = ${d.b}  ${d.reason}`);
  }

  console.log('\n' + lines.join('\n'));
  expect(DRAFTS.length).toBeGreaterThan(0);
});
