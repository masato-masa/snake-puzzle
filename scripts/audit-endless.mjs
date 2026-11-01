// むげんモードの監査。1〜N 面を実際に作り、生成時間・段（どこまで緩めたか）・手数・★の分布を出す。
//
//   node scripts/audit-endless.mjs            # 1〜200 面
//   node scripts/audit-endless.mjs 50         # 1〜50 面
//   node scripts/audit-endless.mjs 200 --quality   # auditLevel の指摘も数える（遅い）
//
// 生成条件（src/levels/endless.ts）を変えたら毎回走らせる。
import { register } from 'node:module';

register('./ts-loader.mjs', import.meta.url);

const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const quality = args.includes('--quality');

const { generateEndless, endlessOptionsFor } = await import('../src/levels/endless.ts');
const { auditLevel } = await import('../src/engine/index.ts');

const rows = [];
for (let n = 1; n <= N; n++) {
  const t = performance.now();
  const e = generateEndless(n);
  const ms = performance.now() - t;
  const issues = quality ? auditLevel(e.level).issues.length : null;
  rows.push({ n, ms, e, issues });
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const fmt = (x) => x.toFixed(0);

console.log(`\n## むげん 1〜${N} 面\n`);
const bands = [];
for (let lo = 1; lo <= N; lo += 25) bands.push([lo, Math.min(N, lo + 24)]);
bands.push([1, N]);
console.log('| 面 | 平均 ms | p95 ms | 最大 ms | 生成 | 緩め | 簡単 | 本編 | 手数 平均（最小〜最大） | ★1-5 | 2匹以上 | 仕掛けあり |' + (quality ? ' 監査指摘あり |' : ''));
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|' + (quality ? '---|' : ''));
for (const [lo, hi] of bands) {
  const part = rows.filter((r) => r.n >= lo && r.n <= hi);
  const ms = part.map((r) => r.ms);
  const by = (s) => part.filter((r) => r.e.source === s).length;
  const moves = part.map((r) => r.e.level.parMoves ?? 0);
  const stars = [1, 2, 3, 4, 5].map((s) => part.filter((r) => r.e.level.difficulty === s).length);
  const multi = part.filter((r) => r.e.level.snakes.length > 1).length;
  const gimmick = part.filter(
    (r) => r.e.level.sands || r.e.level.warps || r.e.level.gates,
  ).length;
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(
    `| ${lo}〜${hi} | ${fmt(avg(ms))} | ${fmt(pct(ms, 0.95))} | ${fmt(Math.max(...ms))} | ${by('generated')} | ${by('relaxed')} | ${by('simple')} | ${by('fallback')} | ${avg(moves).toFixed(1)}（${Math.min(...moves)}〜${Math.max(...moves)}） | ${stars.join('/')} | ${multi} | ${gimmick} |` +
      (quality ? ` ${part.filter((r) => r.issues > 0).length} |` : ''),
  );
}

if (args.includes('--list')) {
  for (const r of rows) {
    const o = endlessOptionsFor(r.n);
    console.log(
      `${r.n}\t${fmt(r.ms)}ms\t${r.e.source}\t${r.e.level.rows}x${r.e.level.cols}\t[${r.e.level.snakes.map((s) => s.body.length)}]\t${r.e.level.parMoves}手\t★${r.e.level.difficulty}\t目標${r.e.targetScore.toFixed(0)}\t実${r.e.analysis?.score.toFixed(0) ?? '-'}\t(条件 ${o.rows}x${o.cols} [${o.snakeLengths}] 壁${o.wallCount} 砂${o.sandCount} ワ${o.warpPairCount} ゲ${o.gateGroupCount})` +
        (quality ? `\t指摘${r.issues}` : ''),
    );
  }
}

// 失敗しない設計の確認: 予算 0 でも面が出る
const zero = generateEndless(7, { attemptBudget: 0 });
console.log(`\n予算 0 → ${zero.source}（${zero.level.id}、${zero.level.parMoves}手）`);
