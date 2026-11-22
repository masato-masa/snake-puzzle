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
 *
 * 全体構成（100面、10面ごとに難度帯とテーマを変える）:
 *   1〜10   ギミックなし。★1〜2、5面目と10面目に山を作る
 *   11〜20  ギミックなし（tangle系）。★2〜3
 *   21〜30  ギミックなし（tangle系、密度アップ）。★3以上
 *   31〜40  砂テーマ。★1→★5へ徐々に
 *   41〜50  ゲート・スイッチテーマ。★1→★5へ徐々に
 *   51〜60  ワープ穴テーマ。★1→★5へ徐々に
 *   61〜70  旧31〜40（tangle系の応用、見た目のみ「氷」だった面）を再配置。★1→★5
 *   71〜100 これまでのギミックを複数組み合わせた、自由度の高い終盤。★2→★5
 * WORLDS（章）は 20 面ごとに区切っており、上の10面区切りの
 * 難度カーブ・ギミック方針はこの LEVELS の並び順（＝表示番号）で管理している。
 */
export const LEVELS: Level[] = [
  // ================= 1〜10: きほん =================
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
    difficulty: 1,
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
  },
  {
    // 問い: 曲がった形は、動くたびに残っていく（折れが2回残るジグザグ）
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
    difficulty: 1,
  },
  {
    // 問い: ステージエディタで作られた面。壁だけの盤で遠回りする
    id: 'custom-1787664432804',
    name: '壁のあいだ',
    rows: 6,
    cols: 6,
    walls: cells([[1, 1], [3, 2], [2, 3], [4, 0]]),
    targets: targets([[2, 2]]),
    snakes: [snake('a', snakeColors.green, [[5, 5]])],
    parMoves: 6,
    difficulty: 2,
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
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[2, 0]]),
    ],
    parMoves: 2,
    difficulty: 1,
    audit: {
      reason: '仲間(b)は最初から目的地で待つのが問い。1匹しか動かないのは意図どおり。',
      allowDegenerate: true,
    },
  },
  {
    // 問い(E+B): 先に降りたヘビが、あとから来るヘビの壁になる。順番が逆だと届かない
    id: 'companion-block-5x4',
    name: '先に降りて壁になる',
    rows: 5,
    cols: 4,
    walls: [],
    targets: targets([
      [3, 3],
      [4, 3],
      [4, 0],
      [4, 1],
      [4, 2],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 3], [0, 2]]),
      snake('b', snakeColors.sky, [[4, 1], [4, 0], [3, 0]]),
    ],
    parMoves: 2,
    difficulty: 1,
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
      snake('c', snakeColors.pink, [[0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[3, 1], [4, 1]]),
      snake('a', snakeColors.green, [[2, 4], [2, 5]]),
    ],
    parMoves: 3,
    difficulty: 2,
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
    difficulty: 2,
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
    difficulty: 3,
  },
  // ================= 11〜20: まがりみち =================
  {
    // 問い(A+E): tangle-dense系の序章。壁1枚＋2匹だけの軽い絡み合い（BFS逆引き探索で発見）。
    id: 'tangle-lite-6x6',
    name: '二匹のもつれ・序章',
    rows: 6,
    cols: 6,
    walls: cells([[3, 3]]),
    targets: targets([
      [0, 0],
      [0, 1],
      [1, 0],
      [5, 3],
      [5, 4],
      [5, 5],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 8,
    difficulty: 2,
  },
  {
    // 問い(A+E): tangle-lite-6x6よりさらに一段易しい。壁2枚＋2匹の脇道パターン（BFS逆引き探索で発見）。
    id: 'tangle-lite-5x5-a',
    name: '二匹のもつれ・脇道',
    rows: 5,
    cols: 5,
    walls: cells([[2, 1], [1, 3]]),
    targets: targets([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 2],
      [2, 2],
      [2, 3],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[4, 0], [4, 1], [4, 2]]),
      snake('b', snakeColors.sky, [[3, 2], [3, 1], [3, 0]]),
    ],
    parMoves: 7,
    difficulty: 2,
  },
  {
    // 問い(A+E): 長さ2匹+4匹の非対称。長いほうが縦の壁になる（BFS逆引き探索で発見）。
    id: 'tangle-lite-5x5-b',
    name: '二匹のもつれ・大小',
    rows: 5,
    cols: 5,
    walls: cells([[2, 2]]),
    targets: targets([
      [0, 0],
      [1, 0],
      [4, 3],
      [3, 3],
      [2, 3],
      [1, 3],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[1, 3], [1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 6,
    difficulty: 2,
  },
  {
    // 問い(A+E): 5x5・2匹。壁1枚だけの軽い絡み合い（BFS逆引き探索で発見）。
    id: 'tangle-gap-5x5',
    name: 'すきまのふたり',
    rows: 5,
    cols: 5,
    walls: cells([[2, 2]]),
    targets: targets([[0, 0], [1, 0], [4, 2], [4, 3], [4, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 4], [0, 3]]),
      snake('b', snakeColors.sky, [[4, 0], [4, 1], [4, 2]]),
    ],
    parMoves: 7,
    difficulty: 2,
  },
  {
    // 問い(A+E): tangle-lite/dense の中間帯。壁1枚＋2匹、水平配置（BFS逆引き探索で発見）。
    id: 'tangle-mid-a-7x6',
    name: '二匹のもつれ・中位A',
    rows: 7,
    cols: 6,
    walls: cells([[3, 3]]),
    targets: targets([
      [0, 0],
      [0, 1],
      [0, 2],
      [6, 5],
      [5, 5],
      [5, 4],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 5], [6, 4], [6, 3]]),
    ],
    parMoves: 9,
    difficulty: 3,
  },
  {
    // 問い(A+E): 非対称な長さ(3+4)の2匹。壁2枚（BFS逆引き探索で発見）。
    id: 'tangle-diff-5x6',
    name: '長さのちがうふたり',
    rows: 5,
    cols: 6,
    walls: cells([[2, 3], [3, 1]]),
    targets: targets([[4, 0], [3, 0], [2, 0], [0, 5], [0, 4], [0, 3], [0, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[4, 5], [4, 4], [4, 3], [4, 2]]),
    ],
    parMoves: 7,
    difficulty: 2,
  },
  {
    // 問い(E): 3匹の三すくみ。壁1枚（BFS逆引き探索で発見）。
    id: 'tangle-triad-mini-6x6',
    name: '三匹のすきま',
    rows: 6,
    cols: 6,
    walls: cells([[3, 3]]),
    targets: targets([[5, 0], [4, 0], [2, 5], [3, 5], [3, 2], [3, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
      snake('c', snakeColors.pink, [[0, 5], [1, 5]]),
    ],
    parMoves: 5,
    difficulty: 2,
  },
  {
    // 問い(A+E): 中間帯・6x7。壁1枚＋2匹（BFS逆引き探索で発見）。
    id: 'tangle-mid-6x7',
    name: '二匹のもつれ・中級',
    rows: 6,
    cols: 7,
    walls: cells([[4, 2]]),
    targets: targets([
      [5, 1],
      [4, 1],
      [4, 0],
      [0, 6],
      [0, 5],
      [0, 4],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 11,
    difficulty: 3,
  },
  {
    // 問い(A+E): 中間帯・7x7・縦向き配置。最短解が1通りしかない（BFS逆引き探索で発見）。
    id: 'tangle-mid-b-7x7',
    name: '二匹のもつれ・中位B',
    rows: 7,
    cols: 7,
    walls: cells([[3, 4]]),
    targets: targets([
      [0, 6],
      [1, 6],
      [2, 6],
      [6, 1],
      [6, 0],
      [5, 0],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [1, 0], [2, 0]]),
      snake('b', snakeColors.sky, [[6, 6], [5, 6], [4, 6]]),
    ],
    parMoves: 11,
    difficulty: 3,
  },
  {
    // 問い(A+E): tangle-dense手前の帯。壁1枚＋2匹（BFS逆引き探索で発見）。
    id: 'tangle-mid-7x7-a',
    name: '二匹のもつれ・上級A',
    rows: 7,
    cols: 7,
    walls: cells([[5, 2]]),
    targets: targets([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 6],
      [4, 6],
      [4, 5],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 12,
    difficulty: 4,
  },
  // ================= 21〜30: からみあい =================
  {
    // 問い(A+E): 3匹の蛇が互いの通り道を塞ぎ合う。壁1枚＋3匹だけの絡み合い（BFS逆引き探索で発見）。
    id: 'tangle-triad-6x6',
    name: '三匹のもつれ',
    rows: 6,
    cols: 6,
    walls: cells([[2, 3]]),
    targets: targets([
      [5, 5],
      [5, 4],
      [5, 3],
      [0, 5],
      [0, 4],
      [5, 1],
      [5, 0],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 5], [4, 5]]),
      snake('c', snakeColors.pink, [[5, 0], [4, 0]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(E+A): 壁なし・3匹の相互依存だけで止まる理由を作る（BFS逆引き探索で発見）。
    id: 'triad-corner-6x6',
    name: '三匹の曲がり角',
    rows: 6,
    cols: 6,
    walls: [],
    targets: targets([[0, 0], [1, 0], [3, 5], [4, 1], [4, 5], [5, 0], [5, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
      snake('c', snakeColors.pink, [[2, 5], [2, 4], [2, 3]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(A+E): 7x8のより大きい盤で、2匹だけの密な絡み合い（BFS逆引き探索で発見）。
    id: 'twin-corridor-7x8',
    name: 'ふたりの回廊',
    rows: 7,
    cols: 8,
    walls: cells([[3, 3], [3, 4]]),
    targets: targets([[0, 0], [0, 1], [1, 0], [6, 4], [6, 5], [6, 6], [6, 7]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[6, 7], [6, 6], [6, 5]]),
    ],
    parMoves: 11,
    difficulty: 3,
  },
  {
    // 問い(E+A): 壁なし・3匹版のもう一種（BFS逆引き探索で発見）。
    id: 'triad-corner-6x7',
    name: '三匹の回り道',
    rows: 6,
    cols: 7,
    walls: [],
    targets: targets([[0, 0], [0, 6], [1, 0], [1, 6], [4, 1], [5, 0], [5, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 6], [5, 5]]),
      snake('c', snakeColors.pink, [[3, 6], [3, 5], [3, 4]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(A+E): 上級帯のもう一種。壁1枚＋2匹（BFS逆引き探索で発見）。
    id: 'tangle-mid-7x7-b',
    name: '二匹のもつれ・上級B',
    rows: 7,
    cols: 7,
    walls: cells([[2, 2]]),
    targets: targets([
      [5, 6],
      [4, 6],
      [3, 6],
      [0, 4],
      [1, 4],
      [2, 4],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 13,
    difficulty: 4,
  },
  {
    // 問い(A+E): 角で曲がって終わる形にして最短解を絞った一枚（BFS逆引き探索で発見）。
    id: 'tangle-corner-6x6',
    name: '二匹のもつれ・かどがえ',
    rows: 6,
    cols: 6,
    walls: cells([[3, 5]]),
    targets: targets([[0, 0], [0, 1], [1, 1], [5, 5], [5, 4], [4, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 5], [0, 4], [0, 3]]),
      snake('b', snakeColors.sky, [[5, 0], [5, 1], [5, 2]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(E): 3匹目は動かなくても壁として機能する構成（BFS逆引き探索で発見）。
    id: 'tangle-triad-6x7',
    name: '三匹のもつれ・回廊',
    rows: 6,
    cols: 7,
    walls: cells([[2, 3]]),
    targets: targets([[5, 0], [4, 0], [3, 0], [4, 6], [5, 6], [5, 5], [0, 6], [1, 6]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 6], [5, 5], [5, 4]]),
      snake('c', snakeColors.pink, [[0, 6], [1, 6]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(A+E): 7x8に広げた上級帯。壁2枚＋2匹、最短解1通り（BFS逆引き探索で発見）。
    id: 'tangle-mid-7x8',
    name: '二匹のもつれ・上級C',
    rows: 7,
    cols: 8,
    walls: cells([[4, 6], [5, 2]]),
    targets: targets([
      [4, 5],
      [4, 4],
      [4, 3],
      [0, 3],
      [0, 4],
      [0, 5],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 13,
    difficulty: 4,
  },
  {
    // 問い(A+E): 長さ4匹+2匹の非対称。tangle-denseの一歩手前（BFS逆引き探索で発見）。
    id: 'tangle-asym-8x7',
    name: '二匹のもつれ・非対称',
    rows: 8,
    cols: 7,
    walls: cells([[5, 3], [6, 5]]),
    targets: targets([
      [5, 5],
      [4, 5],
      [3, 5],
      [2, 5],
      [7, 0],
      [7, 1],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[2, 3], [2, 2]]),
    ],
    parMoves: 12,
    difficulty: 4,
  },
  {
    // 問い(E+A): 壁2枚＋2匹だけ。2匹が交互に相手の胴体を壁として使い合う
    // 密な絡み合いだけで難度を出している（BFS逆引き探索で発見。14手・最短解1通り）。
    id: 'tangle-dense-7x7',
    name: '二匹のもつれ・本編',
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
  },
  // ================= 31〜40: 砂の国 =================
  {
    // 問い(A+E): 砂は「乗ってから止まる」。壁より1マス多く進める最初の1手（BFS逆引き探索で発見）。
    id: 'sand-corner-fold-5x5',
    name: '砂の角折り',
    rows: 5,
    cols: 5,
    walls: cells([[2, 3]]),
    sands: cells([[3, 4]]),
    targets: targets([[2, 1], [2, 2], [3, 0], [3, 1], [3, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[4, 4], [4, 3], [4, 2]]),
    ],
    parMoves: 4,
    difficulty: 1,
  },
  {
    // 問い(A): 砂→壁→盤端、3つの止まる理由をコンパクトに並べた導入面（BFS逆引き探索で発見）。
    id: 'sand-split-corridor-4x6',
    name: '砂の割れ道',
    rows: 4,
    cols: 6,
    walls: cells([[1, 3]]),
    sands: cells([[1, 0]]),
    targets: targets([[1, 1], [1, 2], [0, 5], [1, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[3, 5], [3, 4]]),
    ],
    parMoves: 3,
    difficulty: 1,
  },
  {
    // 問い(A+E): 3匹構成。壁・砂・仲間が揃って初めて最短解が1通りに絞られる（BFS逆引き探索で発見）。
    id: 'sand-trio-relay-5x5',
    name: '砂と三匹の中継',
    rows: 5,
    cols: 5,
    walls: cells([[2, 0]]),
    sands: cells([[2, 4]]),
    targets: targets([[2, 1], [2, 2], [4, 0], [4, 1], [0, 1], [0, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[4, 0], [4, 1]]),
      snake('c', snakeColors.pink, [[0, 4], [1, 4]]),
    ],
    parMoves: 5,
    difficulty: 2,
  },
  {
    // 問い(A+E): 同じヘビが2回、別方向から砂に乗る。砂は入る向きを問わない（BFS逆引き探索で発見）。
    id: 'sand-double-dune-5x6',
    name: '二つの砂丘',
    rows: 5,
    cols: 6,
    walls: cells([[0, 3]]),
    sands: cells([[2, 0], [2, 5]]),
    targets: targets([[0, 4], [0, 5], [3, 5], [4, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[4, 5], [4, 4]]),
    ],
    parMoves: 5,
    difficulty: 2,
  },
  {
    // 問い(A+C): 一度離れてから戻る回り込みに、砂で止まる仲間を組み合わせる（BFS逆引き探索で発見）。
    id: 'sand-hall-loop-6x6',
    name: '砂の回廊',
    rows: 6,
    cols: 6,
    walls: cells([[3, 4]]),
    sands: cells([[1, 5]]),
    targets: targets([[0, 0], [0, 1], [0, 2], [2, 5], [2, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 8,
    difficulty: 3,
  },
  {
    // 問い(A+E): tangle系の骨格に砂を1枚。壁だけでは作れない1マスのずれが唯一解を生む（BFS逆引き探索で発見）。
    id: 'sand-drift-6x6',
    name: '砂すべり・入口',
    rows: 6,
    cols: 6,
    walls: cells([[3, 3]]),
    sands: cells([[5, 4]]),
    targets: targets([[1, 0], [0, 0], [0, 1], [5, 5], [4, 5], [3, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 11,
    difficulty: 3,
  },
  {
    // 問い(A+E): 盤を一周したあと、角の砂に滑り込んで初めて終形に届く（BFS逆引き探索で発見）。
    id: 'sand-corner-7x7',
    name: '砂すべり・かどまち',
    rows: 7,
    cols: 7,
    walls: cells([[5, 2]]),
    sands: cells([[4, 6]]),
    targets: targets([[0, 0], [1, 0], [2, 0], [6, 6], [6, 5], [5, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 13,
    difficulty: 4,
  },
  {
    // 問い(A+E): 同じ壁+砂の組でも横長の盤にすると折り返し方が変わる一枚（BFS逆引き探索で発見）。
    id: 'sand-block-6x7',
    name: '砂すべり・横みち',
    rows: 6,
    cols: 7,
    walls: cells([[2, 4]]),
    sands: cells([[4, 6]]),
    targets: targets([[5, 6], [5, 5], [5, 4], [1, 0], [0, 0], [0, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 13,
    difficulty: 4,
  },
  {
    // 問い(A+E): tangle-dense級の密な絡み合いに砂1枚を足した本編級（BFS逆引き探索で発見）。
    id: 'sand-tangle-7x7',
    name: '砂すべり・本編A',
    rows: 7,
    cols: 7,
    walls: cells([[5, 2]]),
    sands: cells([[6, 4]]),
    targets: targets([[1, 6], [1, 5], [0, 5], [6, 0], [6, 1], [6, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 20,
    difficulty: 5,
  },
  {
    // 問い(A+E): 8x8に広げ、対角の目標を壁1枚+砂1枚だけの往復で埋める本編級（BFS逆引き探索で発見）。
    id: 'sand-far-8x8',
    name: '砂すべり・本編B',
    rows: 8,
    cols: 8,
    walls: cells([[4, 3]]),
    sands: cells([[7, 4]]),
    targets: targets([[6, 0], [6, 1], [7, 1], [0, 7], [0, 6], [0, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
    ],
    parMoves: 18,
    difficulty: 5,
  },
  // ================= 41〜50: ゲートの城 =================
  {
    // 問い(F): はじめてのゲート。スイッチに乗ったら反対側へ抜ける（BFS逆引き探索で発見）。
    id: 'gate-turn-5x6',
    name: 'はじめてのゲート',
    rows: 5,
    cols: 6,
    walls: [],
    gates: [gate(0, 3, 'g')],
    switches: [toggle(4, 5, 'g')],
    targets: targets([[0, 4], [0, 5], [4, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [1, 0]]),
      snake('b', snakeColors.sky, [[4, 1]]),
    ],
    parMoves: 3,
    difficulty: 1,
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
    difficulty: 2,
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
      snake('a', snakeColors.sky, [[2, 3], [2, 4]]),
      snake('b', snakeColors.pink, [[1, 2], [1, 1]]),
    ],
    parMoves: 4,
    difficulty: 2,
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
      snake('m', snakeColors.sky, [[2, 5], [2, 6]]),
      snake('b', snakeColors.green, [[4, 2]]),
      snake('c', snakeColors.pink, [[4, 4]]),
    ],
    parMoves: 3,
    difficulty: 2,
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
      snake('m', snakeColors.sky, [[2, 5], [2, 6]]),
      snake('b', snakeColors.green, [[4, 1], [4, 0]]),
      snake('c', snakeColors.pink, [[4, 5], [4, 6]]),
    ],
    parMoves: 5,
    difficulty: 3,
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
      snake('b', snakeColors.green, [[4, 1], [4, 0]]),
      snake('c', snakeColors.pink, [[4, 8], [4, 9]]),
    ],
    parMoves: 5,
    difficulty: 3,
  },
  {
    // 問い(E+F): スイッチを踏んだ仲間を残し、別のヘビがゲートを抜けて戻ってくる（BFS逆引き探索で発見）。
    id: 'gate-relay-6x6',
    name: '見張りの引き継ぎ',
    rows: 6,
    cols: 6,
    walls: [],
    gates: [gate(3, 3, 'g')],
    switches: [toggle(5, 5, 'g')],
    targets: targets([[2, 5], [1, 5], [0, 5], [4, 0], [4, 1], [5, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 0], [1, 1]]),
      snake('c', snakeColors.pink, [[2, 4]]),
    ],
    parMoves: 8,
    difficulty: 4,
  },
  {
    // 問い(F): 2匹が交代でスイッチ番をする（BFS逆引き探索で発見）。
    id: 'gate-handoff-7x7',
    name: '交代のスイッチ',
    rows: 7,
    cols: 7,
    walls: [],
    gates: [gate(4, 4, 'g')],
    switches: [toggle(6, 1, 'g')],
    targets: targets([[0, 4], [1, 4], [2, 4], [3, 4], [0, 0], [0, 1], [1, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 6], [0, 5], [0, 4], [0, 3]]),
      snake('b', snakeColors.sky, [[1, 6], [1, 5], [1, 4]]),
    ],
    parMoves: 15,
    difficulty: 4,
  },
  {
    // 問い(F+E): スイッチを仲間の体で押さえたまま、別のヘビがゲートを2回抜ける（BFS逆引き探索で作成）
    id: 'gate-tangle-6x6',
    name: '見張り番のもつれ',
    rows: 6,
    cols: 6,
    walls: cells([
      [5, 0],
      [1, 4],
    ]),
    gates: [gate(3, 3, 'g')],
    switches: [toggle(5, 5, 'g')],
    targets: targets([
      [2, 5],
      [2, 4],
      [3, 4],
      [3, 0],
      [3, 1],
    ]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 0], [1, 1]]),
    ],
    parMoves: 16,
    difficulty: 5,
  },
  {
    // 問い: ステージエディタで作られた面。スイッチを踏んだ仲間を残し、もう1匹がゲートの先で長く回り込む
    id: 'custom-1787664752585',
    name: 'スイッチと遠回り',
    rows: 6,
    cols: 6,
    walls: cells([[2, 2]]),
    gates: [gate(0, 3, 'g')],
    switches: [toggle(2, 1, 'g')],
    targets: targets([[4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 2], [0, 1], [0, 0]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4], [5, 3]]),
    ],
    parMoves: 17,
    difficulty: 5,
  },
  // ================= 51〜60: ワープのほこら =================
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
    difficulty: 1,
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
    audit: {
      reason: 'b は最初から目的地で待つ。ワープを抜けた a の進路をふさぐのが問い。',
      allowDegenerate: true,
    },
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
    difficulty: 1,
  },
  {
    // 問い(G+E): ワープを抜けて別の段へ移動。仲間の胴体が最後の壁になる（BFS逆引き探索で発見）。
    id: 'warp-swap-6x6',
    name: 'ワープで段を変える',
    rows: 6,
    cols: 6,
    walls: [],
    warps: [warp([1, 4], [4, 1])],
    targets: targets([[4, 5], [4, 4], [4, 3], [5, 0], [4, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 9,
    difficulty: 2,
  },
  {
    // 問い(G+A): ワープを抜けたあと、壁で止まる場所を作る（BFS逆引き探索で発見）。
    id: 'warp-corner-7x6',
    name: 'ワープと壁の角',
    rows: 7,
    cols: 6,
    walls: cells([[5, 2]]),
    warps: [warp([1, 3], [4, 0])],
    targets: targets([[0, 0], [0, 1], [1, 1], [0, 2], [0, 3]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 3], [0, 4], [0, 5]]),
      snake('b', snakeColors.sky, [[6, 0], [6, 1]]),
    ],
    parMoves: 6,
    difficulty: 2,
  },
  {
    // 問い(G+E): 長い蛇がワープを抜けて向きを保ったまま進む。短い蛇の胴体が壁になる（BFS逆引き探索で発見）。
    id: 'warp-relay-6x6',
    name: '穴のリレー',
    rows: 6,
    cols: 6,
    walls: [],
    warps: [warp([0, 5], [5, 0])],
    targets: targets([[5, 5], [4, 5], [4, 4], [3, 4], [0, 0], [1, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(G+E): 3匹とも短い。誰から動かすかで後続の止まる場所が変わる（BFS逆引き探索で発見）。
    id: 'warp-triad-6x6',
    name: '三匹のワープ',
    rows: 6,
    cols: 6,
    walls: [],
    warps: [warp([0, 5], [5, 0])],
    targets: targets([[5, 5], [5, 4], [0, 0], [1, 0], [5, 2], [5, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
      snake('c', snakeColors.pink, [[2, 5], [3, 5]]),
    ],
    parMoves: 9,
    difficulty: 3,
  },
  {
    // 問い: ステージエディタで作られた面。ワープ穴を抜けて4匹をまとめる
    id: 'custom-1787664829861',
    name: 'ワープと四匹',
    rows: 7,
    cols: 7,
    walls: cells([[4, 1]]),
    sands: cells([[1, 5]]),
    warps: [warp([0, 3], [3, 3])],
    targets: targets([[2, 1], [3, 1], [3, 2], [3, 4], [3, 5], [2, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 1], [0, 0]]),
      snake('b', snakeColors.sky, [[0, 6]]),
      snake('c', snakeColors.pink, [[6, 0]]),
      snake('d', snakeColors.amber, [[6, 5], [6, 6]]),
    ],
    parMoves: 8,
    difficulty: 4,
  },
  {
    // 問い(G+G+A+E): ワープ2組。両方を経由しないと解けない構成（BFS逆引き探索で発見）。
    id: 'warp-cross-7x7',
    name: '交差するワープ',
    rows: 7,
    cols: 7,
    walls: cells([[3, 3]]),
    warps: [warp([0, 6], [6, 0]), warp([6, 6], [0, 4])],
    targets: targets([[0, 0], [1, 0], [2, 0], [3, 0], [6, 3], [5, 3]]),
    snakes: [
      snake('a', snakeColors.green, [[3, 0], [2, 0], [1, 0], [0, 0]]),
      snake('b', snakeColors.sky, [[3, 6], [3, 5]]),
    ],
    parMoves: 13,
    difficulty: 4,
  },
  {
    // 問い(G+A+E): tangle-dense-7x7と同格の作り方で、壁の一部をワープに置き換えた構成（BFS逆引き探索で発見）。
    id: 'warp-mesh-7x6',
    name: 'ワープの網目',
    rows: 7,
    cols: 6,
    walls: cells([[3, 3]]),
    warps: [warp([0, 5], [6, 0])],
    targets: targets([[3, 5], [2, 5], [1, 5], [5, 0], [5, 1], [5, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 5], [6, 4], [6, 3]]),
    ],
    parMoves: 16,
    difficulty: 5,
  },
  // ================= 61〜70: こおりの回廊（見た目のみ。しかけはtangle系と共通） =================
  {
    // 問い(A+E): 壁だけの盤で遠回りする、易しい導入
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
    difficulty: 1,
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
    difficulty: 1,
  },
  {
    // 問い(A+E): 6x7の回り道。壁1枚＋2匹（BFS逆引き探索で発見）。
    id: 'tangle-detour-6x7',
    name: 'ふたりの遠回り',
    rows: 6,
    cols: 7,
    walls: cells([[3, 3]]),
    targets: targets([[5, 6], [4, 6], [2, 3], [1, 3], [0, 3], [0, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 6], [0, 5]]),
      snake('b', snakeColors.sky, [[5, 0], [5, 1], [5, 2], [5, 3]]),
    ],
    parMoves: 8,
    difficulty: 2,
  },
  {
    // 問い(A+E): 壁1枚＋2匹。長い蛇が壁と自分の体で折り返す（BFS逆引き探索で発見）。
    id: 'edge-shuffle-6x5',
    name: 'ふたりのすれ違い',
    rows: 6,
    cols: 5,
    walls: cells([[3, 2]]),
    targets: targets([[1, 3], [1, 4], [2, 0], [3, 0], [4, 0], [5, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[5, 0], [5, 1]]),
      snake('b', snakeColors.sky, [[0, 4], [0, 3], [0, 2], [0, 1]]),
    ],
    parMoves: 9,
    difficulty: 2,
  },
  {
    // 問い(A+E): 非対称(2+4)。長いほうが先に盤を一周する（BFS逆引き探索で発見）。
    id: 'tangle-asym-7x6',
    name: '二匹のもつれ・大小差',
    rows: 7,
    cols: 6,
    walls: cells([[3, 2]]),
    targets: targets([[6, 5], [5, 5], [0, 0], [1, 0], [2, 0], [2, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[6, 5], [6, 4], [6, 3], [6, 2]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(A+E): 3匹(4+2+2)。長い蛇が縦の壁を作ってから2匹が隅へ収まる（BFS逆引き探索で発見）。
    id: 'tangle-triad-7x7',
    name: '三匹のもつれ・追い越し',
    rows: 7,
    cols: 7,
    walls: cells([[5, 3]]),
    targets: targets([[6, 0], [6, 1], [5, 1], [4, 1], [0, 6], [0, 5], [6, 6], [6, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[6, 6], [6, 5]]),
      snake('c', snakeColors.pink, [[6, 0], [5, 0]]),
    ],
    parMoves: 11,
    difficulty: 3,
  },
  {
    // 問い(A+E): 壁1枚だけ。長さ4+2の非対称な絡み合い（BFS逆引き探索で発見）。
    id: 'tangle-swap-6x6',
    name: '二匹のもつれ・上級D',
    rows: 6,
    cols: 6,
    walls: cells([[2, 4]]),
    targets: targets([[5, 5], [5, 4], [5, 3], [4, 3], [0, 1], [0, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 14,
    difficulty: 4,
  },
  {
    // 問い(A+E): 対称3+3。対角の壁2枚を両方使い切る（BFS逆引き探索で発見）。
    id: 'tangle-diag-7x7',
    name: '二匹のもつれ・上級E',
    rows: 7,
    cols: 7,
    walls: cells([[2, 2], [5, 5]]),
    targets: targets([[0, 0], [1, 0], [2, 0], [4, 6], [4, 5], [3, 5]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 6], [0, 5], [0, 4]]),
      snake('b', snakeColors.sky, [[6, 0], [6, 1], [6, 2]]),
    ],
    parMoves: 15,
    difficulty: 4,
  },
  {
    // 問い: 2匹だけ・壁1枚だけで、互いの胴体を壁にも足場にも使いながら詰める（BFS逆引き探索で作成）
    id: 'tangle-dense-8x8',
    name: '二匹のもつれ・応用',
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
  },
  {
    // 問い(A+E): 対角進入・7x7。tangle-dense-7x7と同格の20手級（BFS逆引き探索で発見）。
    id: 'tangle-epic-7x7',
    name: '二匹のもつれ・極',
    rows: 7,
    cols: 7,
    walls: cells([[1, 4], [5, 2]]),
    targets: targets([[0, 3], [1, 3], [1, 2], [4, 2], [3, 2], [2, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 6], [6, 5], [6, 4]]),
    ],
    parMoves: 20,
    difficulty: 5,
  },
  // ================= 71〜100: すべてを組み合わせて =================
  {
    // 問い(F+A): ゲートを抜けた先、砂がもう1マス進ませてから止める（BFS逆引き探索で発見）。
    id: 'gate-sand-turn-6x7',
    name: 'ゲートのすぐ先で曲がる',
    rows: 6,
    cols: 7,
    walls: cells([[4, 3]]),
    sands: cells([[2, 1]]),
    gates: [gate(2, 3, 'g')],
    switches: [toggle(4, 4, 'g')],
    targets: targets([[5, 1], [4, 1], [5, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[2, 4], [2, 5]]),
      snake('b', snakeColors.sky, [[4, 5]]),
    ],
    parMoves: 4,
    difficulty: 2,
  },
  {
    // 問い(F+A): 体長1のヘビがゲートを抜けて砂で止まり、二段曲がりする（BFS逆引き探索で発見）。
    id: 'gate-sand-zigzag-6x9',
    name: 'ゲートと砂のジグザグ',
    rows: 6,
    cols: 9,
    walls: cells([[1, 5], [0, 8], [4, 4], [3, 7]]),
    sands: cells([[2, 4]]),
    gates: [gate(2, 2, 'g')],
    switches: [toggle(1, 8, 'g')],
    targets: targets([[3, 6], [1, 6], [1, 7]]),
    snakes: [
      snake('a', snakeColors.green, [[2, 1]]),
      snake('b', snakeColors.sky, [[3, 8], [4, 8]]),
    ],
    parMoves: 5,
    difficulty: 2,
  },
  {
    // 問い(G+A): ワープで盤の反対側へ、そのまま向きを保って砂に届く（BFS逆引き探索で発見）。
    id: 'warp-sand-relay-6x6',
    name: '穴のリレー（短）',
    rows: 6,
    cols: 6,
    walls: [],
    sands: cells([[2, 4]]),
    warps: [warp([1, 0], [4, 5])],
    targets: targets([[5, 4], [4, 4], [1, 5], [1, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 7,
    difficulty: 2,
  },
  {
    // 問い(G+A): 3匹目は最初から動かず、cが砂とワープを経由してbの隣に収まる（BFS逆引き探索で発見）。
    id: 'warp-sand-triad-6x6',
    name: '三匹のワープ（別配置）',
    rows: 6,
    cols: 6,
    walls: [],
    sands: cells([[3, 4]]),
    warps: [warp([2, 0], [3, 5])],
    targets: targets([[0, 0], [0, 1], [1, 5], [1, 4], [0, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
      snake('c', snakeColors.pink, [[0, 5]]),
    ],
    parMoves: 5,
    difficulty: 2,
  },
  {
    // 問い(F+F+A): 2組のスイッチを同時に踏んでいる間だけ、両方のゲートが開く（BFS逆引き探索で発見）。
    id: 'gate-sand-double-6x9',
    name: '二つのゲートと砂',
    rows: 6,
    cols: 9,
    walls: cells([[0, 0], [3, 1]]),
    sands: cells([[2, 6]]),
    gates: [gate(2, 2, 'g'), gate(2, 4, 'h')],
    switches: [toggle(0, 5, 'g'), toggle(0, 1, 'h')],
    targets: targets([[5, 6], [4, 6], [0, 8], [0, 7], [2, 1], [1, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[2, 1], [2, 0]]),
      snake('p', snakeColors.sky, [[3, 5], [4, 5]]),
      snake('q', snakeColors.pink, [[0, 3], [0, 4]]),
    ],
    parMoves: 6,
    difficulty: 3,
  },
  {
    // 問い(E+F+A): 自分の尻尾が仲間の通り道をふさいでいる。動くと同時に道が空く（BFS逆引き探索で発見）。
    id: 'gate-sand-unblock-7x9',
    name: '自分の壁をどける',
    rows: 7,
    cols: 9,
    walls: cells([[5, 0], [4, 2], [5, 5]]),
    sands: cells([[2, 5]]),
    gates: [gate(2, 3, 'g')],
    switches: [toggle(4, 0, 'g')],
    targets: targets([[4, 8], [4, 7], [4, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[2, 1], [2, 0]]),
      snake('b', snakeColors.sky, [[0, 0]]),
    ],
    parMoves: 6,
    difficulty: 3,
  },
  {
    // 問い(G+A): 縦長回廊で2匹の長い蛇だけを使う。ワープを抜けて反対列に届く（BFS逆引き探索で発見）。
    id: 'warp-sand-corridor-7x6',
    name: '細長い回廊のワープ',
    rows: 7,
    cols: 6,
    walls: [],
    sands: cells([[3, 2]]),
    warps: [warp([1, 5], [5, 0])],
    targets: targets([[1, 0], [2, 0], [3, 0], [3, 5], [3, 4], [3, 3]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 5], [6, 4], [6, 3]]),
    ],
    parMoves: 11,
    difficulty: 3,
  },
  {
    // 問い(G+A+E): ワープ・砂・壁の3要素がすべて必須になる密な一枚（BFS逆引き探索で発見）。
    id: 'warp-sand-diagonal-6x6',
    name: '対角線のワープ',
    rows: 6,
    cols: 6,
    walls: cells([[2, 3]]),
    sands: cells([[4, 1]]),
    warps: [warp([1, 5], [5, 2])],
    targets: targets([[0, 2], [1, 2], [2, 2], [5, 0], [5, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 9,
    difficulty: 3,
  },
  {
    // 問い(F+G): スイッチに乗ったヘビが最初からいるため序盤はゲートが開いている（BFS逆引き探索で発見）。
    id: 'gate-warp-relay-6x6',
    name: 'ゲートの中継地点',
    rows: 6,
    cols: 6,
    walls: [],
    gates: [gate(4, 4, 'g')],
    switches: [toggle(1, 0, 'g')],
    warps: [warp([2, 5], [5, 0])],
    targets: targets([[0, 3], [1, 3], [2, 3], [3, 4], [2, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 3], [0, 2], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 5], [5, 4]]),
    ],
    parMoves: 9,
    difficulty: 3,
  },
  {
    // 問い(F+G): 縦長の回廊。ワープを抜けた後の折り返しでゲートを通す（BFS逆引き探索で発見）。
    id: 'gate-warp-corridor-7x6',
    name: '回廊のスイッチ',
    rows: 7,
    cols: 6,
    walls: cells([[3, 2]]),
    gates: [gate(2, 4, 'g')],
    switches: [toggle(5, 0, 'g')],
    warps: [warp([0, 5], [6, 0])],
    targets: targets([[2, 3], [2, 2], [0, 0], [0, 1], [0, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[6, 5], [6, 4], [6, 3]]),
    ],
    parMoves: 10,
    difficulty: 3,
  },
  {
    // 問い(F+A): 3組のゲート/スイッチと砂の回廊。三匹の見張りが同時にスイッチを踏む（BFS逆引き探索で発見）。
    id: 'gate-sand-triple-7x14',
    name: '三つのゲートと砂の回廊',
    rows: 7,
    cols: 14,
    walls: cells([[0, 0], [3, 1], [0, 13]]),
    sands: cells([[2, 11]]),
    gates: [gate(2, 4, 'g'), gate(2, 6, 'h'), gate(2, 8, 'k')],
    switches: [toggle(0, 5, 'g'), toggle(0, 1, 'h'), toggle(0, 9, 'k')],
    targets: targets([[6, 11], [5, 11], [4, 11], [0, 8], [0, 7], [2, 1], [1, 1], [0, 12], [0, 11]]),
    snakes: [
      snake('a', snakeColors.green, [[2, 2], [2, 1], [2, 0]]),
      snake('p', snakeColors.sky, [[3, 5], [4, 5]]),
      snake('q', snakeColors.pink, [[0, 3], [0, 4]]),
      snake('r', snakeColors.amber, [[3, 9], [4, 9]]),
    ],
    parMoves: 8,
    difficulty: 4,
  },
  {
    // 問い(G+A+E): 7列の広い盤で、4節と3節の蛇が互いの通り道を塞ぎ合う（BFS逆引き探索で発見）。
    id: 'warp-sand-double-corridor-6x7',
    name: '二重回廊のワープ',
    rows: 6,
    cols: 7,
    walls: cells([[3, 5]]),
    sands: cells([[1, 1]]),
    warps: [warp([4, 6], [0, 3])],
    targets: targets([[5, 2], [4, 2], [3, 2], [0, 0], [1, 0], [2, 0], [3, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 6], [5, 5], [5, 4], [5, 3]]),
    ],
    parMoves: 12,
    difficulty: 4,
  },
  {
    // 問い(F+G): 壁2枚を足し、2匹の絡み合いの密度を上げたゲート+ワープ面（BFS逆引き探索で発見）。
    id: 'gate-warp-cross-7x7',
    name: '交差するゲート',
    rows: 7,
    cols: 7,
    walls: cells([[3, 3], [3, 4]]),
    gates: [gate(1, 6, 'g')],
    switches: [toggle(5, 6, 'g')],
    warps: [warp([0, 4], [6, 2])],
    targets: targets([[0, 3], [0, 2], [1, 2], [6, 0], [6, 1], [5, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 6], [6, 5], [6, 4]]),
    ],
    parMoves: 14,
    difficulty: 4,
  },
  {
    // 問い(F+F+G): 互いのスイッチを踏み合う相互依存構造。2組のゲートがどちらも飾りにならない（BFS逆引き探索で発見）。
    id: 'gate-pair-warp-7x6',
    name: '二つの見張り番',
    rows: 7,
    cols: 6,
    walls: [],
    gates: [gate(3, 0, 'g'), gate(3, 5, 'h')],
    switches: [toggle(6, 5, 'g'), toggle(0, 0, 'h')],
    warps: [warp([1, 5], [5, 0])],
    targets: targets([[0, 5], [0, 4], [0, 3], [2, 1], [2, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 5], [0, 4], [0, 3]]),
      snake('b', snakeColors.sky, [[6, 0], [6, 1]]),
    ],
    parMoves: 16,
    difficulty: 4,
  },
  {
    // 問い(A+E): 6x7の軽量な絡み合い。他の上級帯より一段易しい構成（BFS逆引き探索で発見）。
    id: 'tangle-light-6x7',
    name: '二匹のもつれ・軽量',
    rows: 6,
    cols: 7,
    walls: cells([[2, 4]]),
    targets: targets([[0, 6], [0, 5], [1, 5], [5, 2], [5, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 6], [5, 5]]),
    ],
    parMoves: 14,
    difficulty: 4,
  },
  {
    // 問い(E): 1マスの3匹目が最終ターゲットの一つに「栓」として最初から乗っている変奏（BFS逆引き探索で発見）。
    id: 'tangle-plug-6x7',
    name: '三匹のもつれ・栓（軽量版）',
    rows: 6,
    cols: 7,
    walls: cells([[3, 2]]),
    targets: targets([[0, 6], [0, 5], [1, 5], [5, 2], [5, 1], [4, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 6], [5, 5]]),
      snake('c', snakeColors.pink, [[5, 2]]),
    ],
    parMoves: 10,
    difficulty: 4,
  },
  {
    // 問い(F+G+A): 三重のからくり。ワープ・砂・ゲートがそれぞれ別の場面で独立に効く（BFS逆引き探索で発見）。
    id: 'gate-warp-sand-triad-7x7',
    name: '三重のからくり',
    rows: 7,
    cols: 7,
    walls: cells([[0, 0]]),
    gates: [gate(3, 3, 'g')],
    switches: [toggle(6, 6, 'g')],
    warps: [warp([1, 5], [2, 1])],
    sands: cells([[5, 1]]),
    targets: targets([[0, 1], [0, 2], [0, 3], [2, 6], [3, 6]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 5], [0, 4], [0, 3]]),
      snake('b', snakeColors.sky, [[6, 5], [6, 4]]),
    ],
    parMoves: 13,
    difficulty: 4,
  },
  {
    // 問い(G+A): ワープを抜けた蛇が砂で止まり、盤の反対側の仲間と絡み合う（BFS逆引き探索で発見）。
    id: 'warp-sand-corner-6x6',
    name: '穴と砂の抜け道',
    rows: 6,
    cols: 6,
    walls: cells([[5, 5]]),
    sands: cells([[1, 4]]),
    warps: [warp([4, 0], [3, 4])],
    targets: targets([[5, 4], [4, 4], [2, 1], [1, 1], [1, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1]]),
      snake('b', snakeColors.sky, [[5, 0], [5, 1], [5, 2]]),
    ],
    parMoves: 11,
    difficulty: 4,
  },
  {
    // 問い(E+F+G): 4匹が別々の役割で連携する。壁で止まる・見張りをする・ワープで移動する（BFS逆引き探索で発見）。
    id: 'quad-gate-warp-7x7',
    name: '四匹のからくり・門と穴',
    rows: 7,
    cols: 7,
    walls: cells([[4, 1], [6, 3]]),
    gates: [gate(3, 4, 'g')],
    switches: [toggle(6, 4, 'g')],
    warps: [warp([1, 2], [5, 6])],
    targets: targets([[3, 1], [2, 1], [3, 2], [4, 6], [3, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 1], [0, 0]]),
      snake('b', snakeColors.sky, [[3, 6]]),
      snake('c', snakeColors.pink, [[6, 6]]),
      snake('d', snakeColors.amber, [[1, 6]]),
    ],
    parMoves: 7,
    difficulty: 4,
  },
  {
    // 問い(A+E+G): 4匹。1匹の動きが次の1匹の壁を作る連鎖に、砂とワープを組み込む（BFS逆引き探索で発見）。
    id: 'quad-sand-warp-7x7',
    name: '四匹のからくり・砂と穴',
    rows: 7,
    cols: 7,
    walls: cells([[6, 1]]),
    sands: cells([[2, 5]]),
    warps: [warp([0, 3], [6, 3])],
    targets: targets([[6, 2], [2, 6], [3, 6], [5, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 4]]),
      snake('b', snakeColors.sky, [[0, 5]]),
      snake('d', snakeColors.amber, [[6, 5]]),
      snake('c', snakeColors.pink, [[0, 2]]),
    ],
    parMoves: 7,
    difficulty: 4,
  },
  {
    // 問い(F): ワープの先へ抜けたヘビが、閉じたゲート自身にぶつかって止まる「もう一段」（BFS逆引き探索で発見）。
    id: 'gate-warp-maze-7x7',
    name: 'ゲートとワープの迷路',
    rows: 7,
    cols: 7,
    walls: cells([[3, 3], [2, 5]]),
    gates: [gate(5, 1, 'g')],
    switches: [toggle(1, 5, 'g')],
    warps: [warp([0, 6], [6, 0])],
    targets: targets([[6, 5], [5, 5], [5, 6], [0, 0], [0, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[6, 6], [6, 5]]),
    ],
    parMoves: 19,
    difficulty: 5,
  },
  {
    // 問い(A+E): 壁1枚だけで盤全体を使い切る、遠隔配置の高難度面（BFS逆引き探索で発見）。
    id: 'tangle-far-7x7',
    name: '二匹のもつれ・遠隔A',
    rows: 7,
    cols: 7,
    walls: cells([[3, 2]]),
    targets: targets([[6, 1], [6, 0], [5, 0], [5, 1], [0, 6], [1, 6]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[6, 6], [6, 5]]),
    ],
    parMoves: 18,
    difficulty: 5,
  },
  {
    // 問い(A+E): 8x8まで拡張した最長級の絡み合い（BFS逆引き探索で発見）。
    id: 'tangle-far-8x8',
    name: '二匹のもつれ・遠隔B',
    rows: 8,
    cols: 8,
    walls: cells([[3, 3]]),
    targets: targets([[0, 5], [1, 5], [1, 6], [1, 7], [7, 0], [6, 0], [5, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2], [0, 3]]),
      snake('b', snakeColors.sky, [[7, 7], [7, 6], [7, 5]]),
    ],
    parMoves: 22,
    difficulty: 5,
  },
  {
    // 問い(E): 1マスの3匹目が「栓」として最終ターゲットに最初から居座り、退く順番が強制される（BFS逆引き探索で発見）。
    id: 'tangle-plug-7x7',
    name: '三匹のもつれ・栓',
    rows: 7,
    cols: 7,
    walls: cells([[4, 4], [5, 0]]),
    targets: targets([[1, 1], [1, 2], [2, 1], [4, 1], [4, 2], [4, 3], [6, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 2], [1, 1], [1, 0]]),
      snake('c', snakeColors.pink, [[4, 2]]),
    ],
    parMoves: 11,
    difficulty: 5,
  },
  {
    // 問い(F+A): スイッチに乗った長いヘビが、体の一部を残してゲートを開け続ける（BFS逆引き探索で作成）。
    id: 'gate-sand-den-6x6',
    name: '見張り番と砂の巣',
    rows: 6,
    cols: 6,
    walls: cells([[1, 4]]),
    sands: cells([[4, 0]]),
    gates: [gate(3, 3, 'g')],
    switches: [toggle(5, 5, 'g')],
    targets: targets([[2, 5], [2, 4], [3, 4], [3, 0], [3, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 0], [0, 1], [0, 2]]),
      snake('b', snakeColors.sky, [[1, 0], [1, 1]]),
    ],
    parMoves: 17,
    difficulty: 5,
  },
  {
    // 問い(G+A): ワープを抜けた蛇が向きを保ったまま進み、その先の砂が止める（BFS逆引き探索で作成）。
    id: 'warp-sand-den-6x6',
    name: '穴を抜けて砂に沈む',
    rows: 6,
    cols: 6,
    walls: cells([[0, 0]]),
    sands: cells([[4, 1]]),
    warps: [warp([1, 4], [2, 1])],
    targets: targets([[1, 1], [0, 1], [0, 2], [4, 5], [4, 4]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 4], [0, 3], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 4], [5, 5]]),
    ],
    parMoves: 14,
    difficulty: 5,
  },
  {
    // 問い(F+G): スイッチから離れた瞬間にゲートが閉じるタイミングと、ワープの合流を両立させる（BFS逆引き探索で作成）。
    id: 'gate-warp-loop-6x6',
    name: 'ゲートと穴の輪舞',
    rows: 6,
    cols: 6,
    walls: cells([[0, 0]]),
    gates: [gate(3, 3, 'g')],
    switches: [toggle(5, 5, 'g')],
    warps: [warp([1, 4], [2, 1])],
    targets: targets([[5, 4], [4, 4], [3, 4], [1, 2], [1, 1]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 4], [0, 3], [0, 2]]),
      snake('b', snakeColors.sky, [[5, 4], [5, 5]]),
    ],
    parMoves: 16,
    difficulty: 5,
  },
  {
    // 問い(E+F+A): 四匹。3節の長いヘビが、3匹の連鎖の末にゲートを抜けて砂で仕上げる（BFS逆引き探索で作成）。
    id: 'quad-gate-sand-7x7',
    name: '四匹のからくり・門と砂',
    rows: 7,
    cols: 7,
    walls: cells([[6, 3]]),
    sands: cells([[4, 1]]),
    gates: [gate(3, 4, 'g')],
    switches: [toggle(6, 4, 'g')],
    targets: targets([[3, 1], [2, 1], [5, 2], [4, 6], [6, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 1], [0, 0]]),
      snake('b', snakeColors.sky, [[3, 6]]),
      snake('c', snakeColors.pink, [[6, 6]]),
      snake('d', snakeColors.amber, [[4, 6]]),
    ],
    parMoves: 8,
    difficulty: 5,
  },
  {
    // 問い(E+F+G): quad-gate-warp-7x7の発展形。ゲートを2度使う一手が加わり、より深い読みを要求する（BFS逆引き探索で作成）。
    id: 'quad-gate-warp-deep-7x7',
    name: '四匹のからくり・門と穴（深）',
    rows: 7,
    cols: 7,
    walls: cells([[4, 1], [6, 3]]),
    gates: [gate(3, 4, 'g')],
    switches: [toggle(6, 4, 'g')],
    warps: [warp([1, 2], [5, 6])],
    targets: targets([[3, 1], [2, 1], [3, 3], [4, 6], [3, 0]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 1], [0, 0]]),
      snake('b', snakeColors.sky, [[3, 6]]),
      snake('c', snakeColors.pink, [[6, 6]]),
      snake('d', snakeColors.amber, [[1, 6]]),
    ],
    parMoves: 8,
    difficulty: 5,
  },
  {
    // 問い(E+F+A): quad-gate-sand-7x7と同じ骨格に、体を1マス伸ばした最終盤（BFS逆引き探索で作成）。
    id: 'quad-gate-sand-long-7x7',
    name: '四匹の門と砂（長）',
    rows: 7,
    cols: 7,
    walls: cells([[6, 3]]),
    sands: cells([[4, 1]]),
    gates: [gate(3, 4, 'g')],
    switches: [toggle(6, 4, 'g')],
    targets: targets([[3, 1], [2, 1], [1, 1], [5, 2], [4, 6], [6, 2]]),
    snakes: [
      snake('a', snakeColors.green, [[0, 1], [0, 0], [1, 0]]),
      snake('b', snakeColors.sky, [[3, 6]]),
      snake('c', snakeColors.pink, [[6, 6]]),
      snake('d', snakeColors.amber, [[4, 6]]),
    ],
    parMoves: 8,
    difficulty: 5,
  },
];

export type WorldTheme = 'meadow' | 'desert' | 'cave' | 'ice' | 'night';

export type World = {
  id: string;
  name: string;
  subtitle: string;
  theme: WorldTheme;
  levelIds: string[];
};

/**
 * 章。テーマ背景が変わる。20 面ごとに区切って 5 章にしている。
 * （1章=1〜20, 2章=21〜40, 3章=41〜60, 4章=61〜80, 5章=81〜100）
 */
export const WORLDS: World[] = [
  {
    id: 'meadow',
    name: '1章 くさはら',
    subtitle: 'すべる・止まる、そして絡み合いへ',
    theme: 'meadow',
    levelIds: [
      'warmup-3x3',
      'wall-5x3',
      'classic-5x5',
      'zigzag-wall-5x5',
      'custom-1787664432804',
      'gentle-companion-3x3',
      'companion-block-5x4',
      'quad-chain-5x6',
      'tangle-6x7',
      'big-heart-11x5',
      'tangle-lite-6x6',
      'tangle-lite-5x5-a',
      'tangle-lite-5x5-b',
      'tangle-gap-5x5',
      'tangle-mid-a-7x6',
      'tangle-diff-5x6',
      'tangle-triad-mini-6x6',
      'tangle-mid-6x7',
      'tangle-mid-b-7x7',
      'tangle-mid-7x7-a',
    ],
  },
  {
    id: 'desert',
    name: '2章 すなのくに',
    subtitle: '深い絡み合いの先に、砂の国が広がる',
    theme: 'desert',
    levelIds: [
      'tangle-triad-6x6',
      'triad-corner-6x6',
      'twin-corridor-7x8',
      'triad-corner-6x7',
      'tangle-mid-7x7-b',
      'tangle-corner-6x6',
      'tangle-triad-6x7',
      'tangle-mid-7x8',
      'tangle-asym-8x7',
      'tangle-dense-7x7',
      'sand-corner-fold-5x5',
      'sand-split-corridor-4x6',
      'sand-trio-relay-5x5',
      'sand-double-dune-5x6',
      'sand-hall-loop-6x6',
      'sand-drift-6x6',
      'sand-corner-7x7',
      'sand-block-6x7',
      'sand-tangle-7x7',
      'sand-far-8x8',
    ],
  },
  {
    id: 'cave',
    name: '3章 どうくつ',
    subtitle: 'ゲートとワープの城',
    theme: 'cave',
    levelIds: [
      'gate-turn-5x6',
      'gate-intro-5x5',
      'gate-orientation-5x7',
      'double-gate-5x7',
      'gate-move-in-7x7',
      'graduation-7x10',
      'gate-relay-6x6',
      'gate-handoff-7x7',
      'gate-tangle-6x6',
      'custom-1787664752585',
      'warp-6x6',
      'warp-block-5x5',
      'gate-via-warp-6x6',
      'warp-swap-6x6',
      'warp-corner-7x6',
      'warp-relay-6x6',
      'warp-triad-6x6',
      'custom-1787664829861',
      'warp-cross-7x7',
      'warp-mesh-7x6',
    ],
  },
  {
    id: 'ice',
    name: '4章 こおりの回廊',
    subtitle: '氷の道と、組み合わさるしかけ',
    theme: 'ice',
    levelIds: [
      'wall-companion-5x6',
      'pillars-6x6',
      'tangle-detour-6x7',
      'edge-shuffle-6x5',
      'tangle-asym-7x6',
      'tangle-triad-7x7',
      'tangle-swap-6x6',
      'tangle-diag-7x7',
      'tangle-dense-8x8',
      'tangle-epic-7x7',
      'gate-sand-turn-6x7',
      'gate-sand-zigzag-6x9',
      'warp-sand-relay-6x6',
      'warp-sand-triad-6x6',
      'gate-sand-double-6x9',
      'gate-sand-unblock-7x9',
      'warp-sand-corridor-7x6',
      'warp-sand-diagonal-6x6',
      'gate-warp-relay-6x6',
      'gate-warp-corridor-7x6',
    ],
  },
  {
    id: 'night',
    name: '5章 よぞら',
    subtitle: 'すべてを組み合わせた、さいごの試練',
    theme: 'night',
    levelIds: [
      'gate-sand-triple-7x14',
      'warp-sand-double-corridor-6x7',
      'gate-warp-cross-7x7',
      'gate-pair-warp-7x6',
      'tangle-light-6x7',
      'tangle-plug-6x7',
      'gate-warp-sand-triad-7x7',
      'warp-sand-corner-6x6',
      'quad-gate-warp-7x7',
      'quad-sand-warp-7x7',
      'gate-warp-maze-7x7',
      'tangle-far-7x7',
      'tangle-far-8x8',
      'tangle-plug-7x7',
      'gate-sand-den-6x6',
      'warp-sand-den-6x6',
      'gate-warp-loop-6x6',
      'quad-gate-sand-7x7',
      'quad-gate-warp-deep-7x7',
      'quad-gate-sand-long-7x7',
    ],
  },
];

export const worldOf = (levelId: string): World | undefined =>
  WORLDS.find((w) => w.levelIds.includes(levelId));

export const themeOf = (levelId: string): WorldTheme => worldOf(levelId)?.theme ?? 'meadow';

export const levelsOfWorld = (world: World): Level[] =>
  world.levelIds.map((id) => LEVELS.find((l) => l.id === id)).filter((l): l is Level => !!l);

/**
 * ステージが遊べるか。1 面目は常に開いている。
 * それ以外は、LEVELS の並び順で 1 つ前の面をクリア済みのときだけ開く（1 面から順にプレイさせる）。
 */
export const isLevelUnlocked = (
  levelId: string,
  isCleared: (levelId: string) => boolean,
): boolean => {
  const index = getLevelIndex(levelId);
  if (index <= 0) return true;
  return isCleared(LEVELS[index - 1].id);
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
