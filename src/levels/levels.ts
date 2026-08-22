import type { Gate, Level, Pos, Snake, Switch, Target } from '@/engine';
import { snakeColors } from '@/theme';

const cells = (list: readonly (readonly [number, number])[]): Pos[] =>
  list.map(([r, c]) => ({ r, c }));

const targets = (list: readonly (readonly [number, number])[]): Target[] =>
  list.map(([r, c]) => ({ pos: { r, c } }));

/** body[0] が頭。以降は尻尾に向かって連続させる。 */
const snake = (
  id: string,
  color: string,
  body: readonly (readonly [number, number])[],
): Snake => ({ id, color, body: cells(body) });

const gate = (r: number, c: number, group = 'g'): Gate => ({ pos: { r, c }, group });
const toggle = (r: number, c: number, group = 'g'): Switch => ({ pos: { r, c }, group });
const warp = (a: readonly [number, number], b: readonly [number, number]) => ({
  a: { r: a[0], c: a[1] },
  b: { r: b[0], c: b[1] },
});

/**
 * ステージ定義。
 * すべての面で「ヘビの長さ合計 = ターゲット数」を守る（validateLevel が検証）。
 * parMoves はソルバー（solve）、difficulty は analyzeLevel が出した値。
 * 並び順は difficulty がなるべく上がっていくように並べている。
 */
export const LEVELS: Level[] = [
  {
    id: 'warmup-3x3',
    name: 'はじめの一歩',
    rows: 3,
    cols: 3,
    walls: [],
    targets: targets([
      [2, 1],
      [2, 2],
    ]),
    snakes: [snake('a', snakeColors.green, [[0, 1], [0, 0]])],
    parMoves: 2,
    difficulty: 2,
    hint: 'ヘビをつまんで、進めたい向きへはらう。ぶつかるまで一気に進むよ。',
  },
  {
    // 問い: 盤の端では止まれない場所に、ブロックを使って止まる
    id: 'wall-5x3',
    name: '壁で止める',
    rows: 5,
    cols: 3,
    walls: cells([[2, 2]]),
    targets: targets([
      [2, 1],
      [3, 1],
      [4, 1],
    ]),
    snakes: [snake('a', snakeColors.green, [[2, 0], [1, 0], [0, 0]])],
    parMoves: 2,
    difficulty: 1,
    hint: '木のブロックがあると、その手前で止まれる。',
  },
  {
    id: 'classic-5x5',
    name: '下の段へ',
    rows: 5,
    cols: 5,
    walls: [],
    targets: targets([
      [4, 2],
      [4, 3],
      [4, 4],
    ]),
    snakes: [snake('a', snakeColors.green, [[0, 2], [0, 1], [0, 0]])],
    parMoves: 2,
    difficulty: 1,
    hint: '進む順番を変えると、同じ 2 手でも行き先が変わる。',
  },
  {
    // 問い: 壁が無い場所で止まりたいときは砂を使う
    // 逆算: 終形 (2,0)(2,1)(2,2) 頭(2,0) ← 左へ滑って盤端で止まる
    //       ← その前は下へ滑って砂(2,3)で止まる（砂が無いと row4 端まで滑ってしまう）
    id: 'sand-intro-4x4',
    name: '砂で止まる',
    rows: 5,
    cols: 4,
    walls: [],
    sands: cells([[2, 3]]),
    targets: targets([
      [2, 0],
      [2, 1],
      [2, 2],
    ]),
    snakes: [snake('a', snakeColors.green, [[1, 3], [1, 2], [1, 1]])],
    parMoves: 2,
    difficulty: 1,
    hint: 'ザラザラした砂に乗ると、そこで止まる。',
  },
  {
    // 問い: 曲がった形は、動くたびに残っていく（折れが2回残るジグザグ）
    // 逆算: 終形(4,4)(3,4)(3,3)(2,3) ← 下へ滑って壁(4,3)で止まる ← 右へ1マス(盤端) ← 下へ1マス(盤端)
    id: 'zigzag-wall-5x5',
    name: 'ジグザグに折れる',
    rows: 5,
    cols: 5,
    walls: cells([[4, 3]]),
    targets: targets([
      [4, 4],
      [3, 4],
      [3, 3],
      [2, 3],
    ]),
    snakes: [snake('a', snakeColors.green, [[0, 3], [0, 2], [0, 1], [0, 0]])],
    parMoves: 3,
    difficulty: 2,
    hint: '曲がるたびに、体の折れ方も変わっていく。',
  },
  {
    // 問い: 仲間は最初から目的地で待っていてもいい。動く壁の最初の一歩
    id: 'gentle-companion-3x3',
    name: '待っている仲間',
    rows: 3,
    cols: 3,
    walls: [],
    targets: targets([
      [1, 2],
      [1, 1],
      [2, 0],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [1, 0]]),
      snake('b', snakeColors.sky, [[2, 0]]),
    ],
    parMoves: 2,
    difficulty: 2,
    hint: '仲間のヘビは最初から目的地で待っている。壁のように使おう。',
    audit: {
      reason: '仲間(b)は最初から目的地で待つのが問い。1匹しか動かないのは意図どおり。',
      allowDegenerate: true,
    },
  },
  {
    // 問い(A+E): 縦ヘビは壁で止まり、横ヘビはそのあと縦ヘビにぶつかって止まる
    id: 'wall-companion-5x6',
    name: '壁と仲間',
    rows: 5,
    cols: 6,
    walls: cells([[4, 1]]),
    targets: targets([
      [1, 1],
      [2, 1],
      [3, 1],
      [3, 2],
      [3, 3],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 1], [1, 1], [0, 1]]),
      snake('b', snakeColors.sky, [[3, 4], [3, 5]]),
    ],
    parMoves: 2,
    difficulty: 3,
    hint: '縦のヘビが壁で止まってから、横のヘビをそこへぶつけよう。',
  },
  {
    // 問い(C+A): 3回曲がって、最後は壁で止まる大きめの折れ形
    id: 'zigzag-triple-6x6',
    name: '大きくジグザグに折れる',
    rows: 6,
    cols: 6,
    walls: cells([[5, 4], [4, 0], [1, 1]]),
    targets: targets([
      [2, 1],
      [3, 1],
      [4, 1],
      [4, 2],
      [4, 3],
    ]),
    snakes: [snake('a', snakeColors.green, [[0, 4], [0, 3], [0, 2], [0, 1], [0, 0]])],
    parMoves: 3,
    difficulty: 2,
    hint: '曲がるたびに、体の折れ方も変わっていく。壁は3枚ある。',
  },
  {
    // 問い(D): 縦向きの頭の位置で押す方向が変わる
    id: 'orientation-vertical-5x3',
    name: '縦向きの頭の位置',
    rows: 5,
    cols: 3,
    walls: [],
    targets: targets([
      [3, 0],
      [4, 0],
      [0, 2],
      [1, 2],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 0], [1, 0]]),
      snake('b', snakeColors.sky, [[1, 2], [2, 2]]),
    ],
    parMoves: 2,
    difficulty: 2,
    hint: '2匹は同じ形に見える。頭の位置を見て、押す向きを決めよう。',
  },
  {
    // 問い(B): aを先に動かさないと、bが先に離れたときaは通りすぎてしまう
    id: 'order-intro-4x6',
    name: '2匹の順番',
    rows: 4,
    cols: 6,
    walls: [],
    targets: targets([
      [3, 0],
      [3, 1],
      [0, 2],
      [0, 3],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[0, 4], [0, 5]]),
    ],
    parMoves: 3,
    difficulty: 4,
    hint: 'a を先に動かそう。b が先に離れると a は右へ通りすぎてしまう。',
  },
  {
    // 見た目: 24マスのハート形。E: とがった先端は、両どなりが正しい順で動いたあとでないと
    // ぴったり止まれない（小さいヘビ blk が先端の「ふた」になる。先にとなりを置いてから使う）
    id: 'big-heart-11x5',
    name: '大きなハートを光らせる',
    rows: 11,
    cols: 5,
    walls: [],
    targets: targets([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ]),
    snakes: [
      snake('c1', snakeColors.sky, [[6, 0], [7, 0], [8, 0], [9, 0]]),
      snake('c2', snakeColors.pink, [[6, 1], [7, 1], [8, 1], [9, 1], [10, 1]]),
      snake('c3', snakeColors.amber, [[6, 2], [7, 2], [8, 2], [9, 2], [10, 2]]),
      snake('c4', snakeColors.sky, [[6, 3], [7, 3], [8, 3], [9, 3], [10, 3]]),
      snake('c5', snakeColors.pink, [[6, 4], [7, 4], [8, 4], [9, 4]]),
      snake('blk', snakeColors.green, [[0, 1]]),
    ],
    parMoves: 6,
    difficulty: 5,
    hint:
      'まん中の割れ目にも小さな光がある。右どなり(c4)を先に上げてから blk を右へ。' +
      'blk が「ふた」になってから、とがった先端(c3)を上げよう。',
  },
  {
    // 問い: 二匹が同じ道を使う。片方が通り終わるまで、もう片方は動けない
    id: 'wide-6x7',
    name: '広い盤面',
    rows: 6,
    cols: 7,
    walls: cells([[5, 4]]),
    targets: targets([
      [5, 0],
      [5, 1],
      [5, 2],
      [5, 3],
      [0, 4],
      [0, 5],
      [0, 6],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[0, 6], [1, 6], [2, 6]]),
    ],
    parMoves: 3,
    difficulty: 2,
  },
  {
    // 問い: 二匹の行き先を入れ替える段取り
    id: 'pillars-6x6',
    name: '入れかわる',
    rows: 6,
    cols: 6,
    walls: [],
    targets: targets([
      [5, 0],
      [5, 1],
      [5, 2],
      [5, 3],
      [0, 5],
      [1, 5],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [1, 0], [2, 0], [3, 0]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 4,
    difficulty: 4,
  },
  {
    // 問い: 穴を抜けた先でも、入った向きのまま進み続ける
    id: 'warp-6x6',
    name: '穴のむこう',
    rows: 6,
    cols: 6,
    walls: [],
    warps: [warp([4, 5], [4, 3])],
    targets: targets([
      [0, 5],
      [0, 4],
      [0, 3],
      [1, 3],
    ]),
    snakes: [snake('a', snakeColors.green, [[3, 1], [3, 0], [4, 0], [5, 0]])],
    parMoves: 4,
    difficulty: 3,
  },
  {
    id: 'trio-7x7',
    name: '三匹の分担',
    rows: 7,
    cols: 7,
    walls: cells([[3, 5]]),
    targets: targets([
      [4, 0],
      [5, 0],
      [6, 0],
      [0, 6],
      [1, 6],
      [2, 6],
      [3, 3],
      [3, 4],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 6], [6, 5], [6, 4]]),
      snake('c', snakeColors.pink, [[3, 1], [3, 0]]),
    ],
    parMoves: 3,
    difficulty: 3,
    hint: '動かす順番をまちがえると、通り道がふさがってしまう。',
  },
  {
    // 問い(E+G): 仲間ヘビが、ワープを抜けた先の進路をふさぐ
    id: 'warp-block-5x5',
    name: 'ワープの先の仲間',
    rows: 5,
    cols: 5,
    walls: [],
    warps: [warp([2, 1], [0, 2])],
    targets: targets([
      [0, 3],
      [0, 4],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 0]]),
      snake('b', snakeColors.sky, [[0, 4]]),
    ],
    parMoves: 1,
    difficulty: 1,
    hint: 'ワープを抜けた先も、仲間にぶつかるまで進み続ける。',
    audit: {
      reason: 'b は最初から目的地で待つ。ワープを抜けた a の進路をふさぐのが問い。',
      allowDegenerate: true,
    },
  },
  {
    // 問い(C+E): 仲間で止まってから曲がる
    id: 'bend-companion-5x5',
    name: '仲間で曲がる',
    rows: 5,
    cols: 5,
    walls: [],
    targets: targets([
      [2, 1],
      [3, 0],
      [3, 1],
      [4, 1],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 1], [1, 1], [0, 1]]),
      snake('c', snakeColors.pink, [[4, 1]]),
    ],
    parMoves: 2,
    difficulty: 3,
    hint: '仲間にぶつかって止まってから、もう一度向きを変えよう。',
    audit: {
      reason: 'c は最初から目的地で待つ。a だけが動いて曲がるのが問い。',
      allowDegenerate: true,
    },
  },
  {
    // 問い: 穴を抜けたあと、十分に進んで穴のマスを完全に手放す
    id: 'warp-drop-7x6',
    name: '穴のマスを手放す',
    rows: 7,
    cols: 6,
    walls: cells([
      [2, 1],
      [3, 5],
    ]),
    warps: [warp([0, 3], [4, 1])],
    targets: targets([
      [3, 4],
      [3, 3],
      [3, 2],
      [3, 1],
    ]),
    snakes: [snake('a', snakeColors.green, [[3, 3], [4, 3], [5, 3], [6, 3]])],
    parMoves: 2,
    difficulty: 2,
    hint: '穴を抜けたあと、もう一度動くと穴のマスから完全に離れられる。',
  },
  {
    // 問い: 4匹の連鎖。dは静止。c→b→aの順に、直前のヘビが壁になる
    id: 'quad-chain-5x6',
    name: '4匹がつながる',
    rows: 5,
    cols: 6,
    walls: [],
    targets: targets([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
      [2, 2],
      [2, 3],
    ]),
    snakes: [
      snake('d', snakeColors.amber, [[0, 0]]),
      snake('c', snakeColors.pink, [[0, 3], [0, 2]]),
      snake('b', snakeColors.sky, [[3, 1], [4, 1]]),
      snake('a', snakeColors.green, [[2, 4], [2, 5]]),
    ],
    parMoves: 3,
    difficulty: 4,
    hint: '4匹目は静止。動かす順番で、次のヘビの壁ができていく。',
  },
  {
    // 問い: 砂で止めたあと、さらに伸びて別の場所に着く（砂のマスからは離れる）
    id: 'sand-cave-6x5',
    name: '砂から先へ',
    rows: 6,
    cols: 5,
    walls: [],
    sands: cells([[2, 4]]),
    targets: targets([
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ]),
    snakes: [snake('a', snakeColors.green, [[1, 4], [1, 3], [1, 2], [1, 1]])],
    parMoves: 2,
    difficulty: 1,
    hint: '砂で止まったあとも、また動かせる。',
  },
  {
    // 問い: 頭の位置で押すべき向きが変わる（大きめの盤でもう一度）
    id: 'orientation-big-3x7',
    name: '頭の向きをもう一度',
    rows: 3,
    cols: 7,
    walls: [],
    targets: targets([
      [0, 6],
      [0, 5],
      [0, 4],
      [2, 0],
      [2, 1],
      [2, 2],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 4], [0, 3], [0, 2]]),
      snake('b', snakeColors.sky, [[2, 2], [2, 3], [2, 4]]),
    ],
    parMoves: 2,
    difficulty: 2,
  },
  {
    // 問い: 仲間を止まり場所にする、もう一つの配置
    // 問い(D+E): 頭の位置で押す向きが変わり、片方は仲間で止まる
    id: 'orientation-companion-5x3',
    name: '向きと仲間',
    rows: 5,
    cols: 3,
    walls: [],
    targets: targets([
      [2, 0],
      [3, 0],
      [4, 0],
      [0, 2],
      [1, 2],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 0], [1, 0]]),
      snake('c', snakeColors.pink, [[4, 0]]),
      snake('b', snakeColors.sky, [[1, 2], [2, 2]]),
    ],
    parMoves: 2,
    difficulty: 3,
    hint: '2匹は同じ形。頭の向きを見て押す方向を決め、片方は仲間で止まる。',
    audit: {
      reason: 'c は最初から目的地で待つ。a は仲間で止まり、b は盤端まで進む。',
      allowDegenerate: true,
    },
  },
  {
    // 問い: スイッチは押している間だけ開く。開けた側は、あとで別の場所へ抜ける
    // 逆算: b が switch(4,0) を押して開ける → a が gate(2,2) を抜けて (2,3)(2,4) へ
    //       → b は switch から上へ抜けて (0,0) へ（switch と target を別マスにする）
    id: 'gate-intro-5x5',
    name: 'スイッチとゲート',
    rows: 5,
    cols: 5,
    walls: [],
    gates: [gate(2, 2)],
    switches: [toggle(4, 0)],
    targets: targets([
      [2, 3],
      [2, 4],
      [0, 0],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 1], [1, 1]]),
      snake('b', snakeColors.sky, [[4, 3]]),
    ],
    parMoves: 3,
    difficulty: 4,
    hint: 'スイッチにヘビが乗っている間だけ、同じ色のゲートが開く。開けたあとは、別の場所へ動かそう。',
  },
  {
    // 問い(F+D): 頭の向きで通るゲートが変わる。スイッチは仲間が押してから離れる
    id: 'gate-orientation-5x7',
    name: '向きとゲート',
    rows: 5,
    cols: 7,
    walls: cells([[4, 2]]),
    gates: [gate(2, 2, 'g'), gate(1, 4, 'g')],
    switches: [toggle(4, 3, 'g')],
    targets: targets([
      [0, 3],
      [2, 0],
      [2, 1],
      [1, 5],
      [1, 6],
    ]),
    snakes: [
      snake('s', snakeColors.green, [[4, 5]]),
      snake('a', snakeColors.sky, [[2, 4], [2, 3]]),
      snake('b', snakeColors.pink, [[1, 1], [1, 2]]),
    ],
    parMoves: 4,
    difficulty: 5,
    hint: 'まず仲間がスイッチへ。2匹は頭の向きで通るゲートが逆になる。仲間は最後に離れよう。',
  },
  {
    // 問い: 二匹が互いの通り道をふさぐ。どちらを先に通すかの段取り
    // 問い(F+G): ワープを抜けてスイッチを押さないとゲートが開かない
    id: 'gate-via-warp-6x6',
    name: 'ワープの先のスイッチ',
    rows: 6,
    cols: 6,
    walls: cells([[4, 4]]),
    warps: [warp([2, 1], [4, 2])],
    gates: [gate(0, 3, 'g')],
    switches: [toggle(4, 3, 'g')],
    targets: targets([
      [5, 3],
      [0, 4],
      [0, 5],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[2, 0]]),
      snake('b', snakeColors.sky, [[0, 1], [0, 0]]),
    ],
    parMoves: 3,
    difficulty: 4,
    hint: 'ワープを抜けてスイッチを押そう。あとで自分のゲートにぶつからない向きで離れよう。',
  },
  {
    // 問い: 二匹をどちらも動かし、互いを足場にして詰める
    id: 'tangle-6x7',
    name: 'もつれ道',
    rows: 6,
    cols: 7,
    walls: cells([
      [4, 1],
      [3, 3],
    ]),
    sands: [],
    targets: targets([
      [3, 2],
      [3, 1],
      [2, 1],
      [1, 1],
      [0, 0],
      [1, 0],
      [2, 0],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[1, 3], [1, 2], [1, 1], [2, 1]]),
      snake('b', snakeColors.sky, [[3, 1], [3, 2], [2, 2]]),
    ],
    parMoves: 6,
    difficulty: 5,
  },
  {
    // 問い: 2つのスイッチを同時に押さえたまま、1匹が2つのゲートを一気に抜ける
    id: 'double-gate-5x7',
    name: '2つのゲートを開ける',
    rows: 5,
    cols: 7,
    walls: [],
    gates: [gate(2, 2, 'g'), gate(2, 4, 'h')],
    switches: [toggle(4, 2, 'g'), toggle(4, 4, 'h')],
    targets: targets([
      [2, 0],
      [2, 1],
      [4, 0],
      [4, 6],
    ]),
    snakes: [
      snake('m', snakeColors.sky, [[2, 6], [2, 5]]),
      snake('b', snakeColors.green, [[4, 2]]),
      snake('c', snakeColors.pink, [[4, 4]]),
    ],
    parMoves: 3,
    difficulty: 4,
    hint: '2つのスイッチを同時に押さえている間だけ、まん中のヘビが両方のゲートを抜けられる。',
  },
  {
    // 問い: 体2マスのヘビでスイッチを押し、自分のゲートを通らない向きで離れる
    id: 'gate-move-in-7x7',
    name: 'スイッチへ行って、離れる',
    rows: 7,
    cols: 7,
    walls: cells([[4, 3]]),
    gates: [gate(2, 2, 'g'), gate(2, 4, 'h')],
    switches: [toggle(4, 2, 'g'), toggle(4, 4, 'h')],
    targets: targets([
      [2, 0],
      [2, 1],
      [6, 2],
      [5, 2],
      [6, 4],
      [5, 4],
    ]),
    snakes: [
      snake('m', snakeColors.sky, [[2, 6], [2, 5]]),
      snake('b', snakeColors.green, [[4, 0], [4, 1]]),
      snake('c', snakeColors.pink, [[4, 6], [4, 5]]),
    ],
    parMoves: 5,
    difficulty: 5,
    hint: '2匹はまずスイッチへ移動しよう。まん中が通ったら、下へ離れよう。',
  },
  {
    // 問い: 頭の位置で押すべき向きが変わる。3匹の頭を見比べる
    id: 'orientation-trio-4x6',
    name: '3匹の頭の向き',
    rows: 4,
    cols: 6,
    walls: [],
    targets: targets([
      [0, 5],
      [0, 4],
      [2, 0],
      [2, 1],
      [3, 4],
      [3, 5],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 3], [0, 2]]),
      snake('b', snakeColors.sky, [[2, 2], [2, 3]]),
      snake('c', snakeColors.pink, [[3, 2], [3, 3]]),
    ],
    parMoves: 3,
    difficulty: 4,
    hint: '3匹それぞれ、頭の位置をよく見て向きを決めよう。',
  },
  {
    // 問い(卒業面 F+E+B): 3マス長の仲間ヘビが、仲間が押さえたゲートを抜ける
    id: 'graduation-7x10',
    name: 'ながいヘビとゲート',
    rows: 7,
    cols: 10,
    walls: cells([[4, 5]]),
    gates: [gate(2, 4, 'g'), gate(2, 6, 'h')],
    switches: [toggle(4, 4, 'g'), toggle(4, 6, 'h')],
    targets: targets([
      [2, 0],
      [2, 1],
      [2, 2],
      [5, 4],
      [6, 4],
      [5, 6],
      [6, 6],
    ]),
    snakes: [
      snake('m', snakeColors.sky, [[2, 7], [2, 8], [2, 9]]),
      snake('b', snakeColors.green, [[4, 0], [4, 1]]),
      snake('c', snakeColors.pink, [[4, 9], [4, 8]]),
    ],
    parMoves: 5,
    difficulty: 5,
    hint: '2匹がスイッチへ。まん中の長いヘビが両方のゲートを抜けたら、2匹は自分のゲートを踏まずに離れよう。',
  },
  {
    // [試作・評価用] 問い(F+E+B): 2つのゲートを別々の2手で抜ける。両方のスイッチは
    // それぞれ自分の手の番までしか保証されないので、離すタイミングを間違えると詰む。
    // [試作v2・評価用] 問い(F+E+B+A強化): スイッチへは直線で行けず、
    // 壁で曲がってからでないと届かない。ゲートを抜くのは1回のスライドで済むが、
    // そこへ至る2匹の経路自体が小さな道順パズルになっている。
    // [試作v3・評価用] 2匹だけ・壁2枚・14手・最短解1通り。
    // ゲート/スイッチは使わず、2匹が交互に相手の胴体を壁として使い合う
    // 密な絡み合いだけで難度を出している（ユーザー提供の参考ステージから
    // 「到達可能な状態をBFS探索→ソルバーで近道が無いことを確認」という手順で発見）。
    id: 'tangle-dense-7x7',
    name: '[試作v3] 二匹のもつれ',
    rows: 7,
    cols: 7,
    walls: cells([[4, 4], [5, 0]]),
    targets: targets([
      [1, 1],
      [1, 2],
      [2, 1],
      [4, 1],
      [4, 2],
      [4, 3],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 14,
    difficulty: 5,
    hint: '正解は1通りしかない。相手の胴体が自分の壁にも足場にもなる。最後の形から逆にたどってみよう。',
  },
  {
    // [試作v4・評価用] 2匹・壁1枚だけ・16手・最短解4通り。前作(tangle-dense-7x7)と
    // 同じ「到達可能な状態をBFS探索→ソルバーで近道が無いことを確認→最短解の本数が
    // 少ないものを選ぶ」手順で発見した、さらに深い（8x8）バージョン。
    id: 'tangle-dense-8x8',
    name: '[試作v4] 二匹のもつれ・応用',
    rows: 8,
    cols: 8,
    walls: cells([[6, 2]]),
    targets: targets([
      [1, 0],
      [2, 0],
      [3, 0],
      [7, 0],
      [7, 1],
      [6, 1],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 2], [0, 1], [0, 0]]),
      snake('b', snakeColors.sky, [[0, 3], [0, 4], [0, 5]]),
    ],
    parMoves: 16,
    difficulty: 5,
    hint: '正解の道筋はごくわずか。相手の胴体が壁にも足場にもなる。終形から逆にたどってみよう。',
  },
];

export type WorldTheme = 'meadow' | 'cave' | 'night';

export type World = {
  id: string;
  name: string;
  subtitle: string;
  theme: WorldTheme;
  levelIds: string[];
};

/**
 * 章。テーマ背景が変わり、章ごとに新しいギミックが出てくる。
 * 次の章は、前の章を 6 割クリアすると開く。
 */
export const WORLDS: World[] = [
  {
    id: 'meadow',
    name: '1章 くさはら',
    subtitle: 'すべる・止まる をおぼえる',
    theme: 'meadow',
    levelIds: [
      'warmup-3x3',
      'wall-5x3',
      'classic-5x5',
      'sand-intro-4x4',
      'zigzag-wall-5x5',
      'gentle-companion-3x3',
      'wall-companion-5x6',
      'zigzag-triple-6x6',
      'orientation-vertical-5x3',
      'order-intro-4x6',
      'big-heart-11x5',
    ],
  },
  {
    id: 'cave',
    name: '2章 どうくつ',
    subtitle: '砂とワープ穴のしかけ',
    theme: 'cave',
    levelIds: [
      'wide-6x7',
      'pillars-6x6',
      'warp-6x6',
      'trio-7x7',
      'warp-block-5x5',
      'bend-companion-5x5',
      'warp-drop-7x6',
      'quad-chain-5x6',
      'sand-cave-6x5',
      'orientation-big-3x7',
      'orientation-companion-5x3',
    ],
  },
  {
    id: 'night',
    name: '3章 よぞら',
    subtitle: 'スイッチと、二匹の連携',
    theme: 'night',
    levelIds: [
      'gate-intro-5x5',
      'gate-orientation-5x7',
      'gate-via-warp-6x6',
      'tangle-6x7',
      'double-gate-5x7',
      'gate-move-in-7x7',
      'orientation-trio-4x6',
      'graduation-7x10',
      'tangle-dense-7x7',
      'tangle-dense-8x8',
    ],
  },
];

/** 次の章が開くのに必要な、前の章のクリア割合。 */
export const UNLOCK_RATIO = 0.6;

export const worldOf = (levelId: string): World | undefined =>
  WORLDS.find((w) => w.levelIds.includes(levelId));

export const themeOf = (levelId: string): WorldTheme => worldOf(levelId)?.theme ?? 'meadow';

export const levelsOfWorld = (world: World): Level[] =>
  world.levelIds.map((id) => LEVELS.find((l) => l.id === id)).filter((l): l is Level => !!l);

/**
 * 章が遊べるか。1 章目は常に開いている。
 * すでにその章を遊んだことがある場合も開いたままにする（あとから条件を足しても閉め出さないため）。
 */
export const isWorldUnlocked = (
  worldIndex: number,
  isCleared: (levelId: string) => boolean,
): boolean => {
  if (worldIndex === 0) return true;
  if (WORLDS[worldIndex].levelIds.some(isCleared)) return true;
  const prev = WORLDS[worldIndex - 1];
  const cleared = prev.levelIds.filter(isCleared).length;
  return cleared >= Math.ceil(prev.levelIds.length * UNLOCK_RATIO);
};

/**
 * 画面に出す名前。番号は LEVELS の並び順から採番する。
 * 定義側に番号を書くと、面を差し込むたびに全部振り直すことになるため。
 */
export const displayName = (level: Level): string => {
  const index = LEVELS.findIndex((l) => l.id === level.id);
  return index >= 0 ? `${index + 1}. ${level.name}` : level.name;
};

export const LEVEL_IDS = LEVELS.map((l) => l.id);

export const getLevel = (id: string): Level | undefined =>
  LEVELS.find((level) => level.id === id);

export const getLevelIndex = (id: string): number =>
  LEVELS.findIndex((level) => level.id === id);

export const getNextLevel = (id: string): Level | undefined => {
  const index = getLevelIndex(id);
  return index === -1 ? undefined : LEVELS[index + 1];
};
