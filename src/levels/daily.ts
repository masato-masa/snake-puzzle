import { generateLevel, type GenerateOptions, type Level } from '@/engine';

/** 日付キー（ローカル時間の YYYY-MM-DD）。 */
export const todayKey = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const previousKey = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
};

/**
 * その日をクリアしたときの連続日数。
 * 前日もクリアしていれば +1、間が空いていれば 1、同じ日の 2 回目は据え置き。
 */
export const nextStreak = (
  previous: { lastClearedDate?: string; streak: number },
  dateKey: string,
): number => {
  if (previous.lastClearedDate === dateKey) return previous.streak;
  if (previous.lastClearedDate === previousKey(dateKey)) return previous.streak + 1;
  return 1;
};

const seedOf = (key: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** 日替わりで顔ぶれが変わるように、レシピを何種類か用意しておく。 */
const RECIPES: GenerateOptions[] = [
  {
    rows: 5,
    cols: 5,
    snakeLengths: [3],
    wallCount: 2,
    sandCount: 2,
    walkMoves: 6,
    minMoves: 4,
    minStars: 3,
    maxStars: 4,
  },
  {
    rows: 6,
    cols: 6,
    snakeLengths: [4],
    wallCount: 3,
    warpPairCount: 1,
    walkMoves: 6,
    minMoves: 4,
    minStars: 3,
    maxStars: 4,
  },
  {
    rows: 6,
    cols: 6,
    snakeLengths: [3, 2],
    wallCount: 3,
    gateGroupCount: 1,
    walkMoves: 7,
    minMoves: 5,
    minStars: 3,
    maxStars: 5,
  },
  {
    rows: 6,
    cols: 7,
    snakeLengths: [4, 3],
    wallCount: 4,
    sandCount: 2,
    walkMoves: 8,
    minMoves: 5,
    minStars: 4,
    maxStars: 5,
  },
];

/** 保険。凝ったレシピで作れなかった日でも必ず 1 面出せるようにする。 */
const FALLBACK: GenerateOptions = {
  rows: 5,
  cols: 5,
  snakeLengths: [3],
  wallCount: 2,
  walkMoves: 5,
  minMoves: 3,
  minStars: 1,
  maxStars: 5,
};

/**
 * その日の問題を組み立てる。日付から seed を作るので、同じ日なら誰が開いても同じ盤面になる。
 * 生成には少し時間がかかるので、呼ぶ側でローディングを見せること。
 */
export const buildDailyLevel = (dateKey: string): Level | null => {
  const seed = seedOf(dateKey);
  const [, month, day] = dateKey.split('-');
  const name = `${Number(month)}月${Number(day)}日のもんだい`;

  const order = [seed % RECIPES.length, (seed + 1) % RECIPES.length, FALLBACK] as const;

  for (const recipe of order) {
    const options = typeof recipe === 'number' ? RECIPES[recipe] : recipe;
    const result = generateLevel({ ...options, seed });
    if (result) {
      return { ...result.level, id: `daily-${dateKey}`, name };
    }
  }
  return null;
};
