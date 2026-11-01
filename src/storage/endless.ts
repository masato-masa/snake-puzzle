import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EndlessLevel } from '@/levels/endless';

/**
 * むげんモードの進み具合。
 * current … 次に遊ぶ面の番号（1 から）
 * best    … クリアした最大の番号
 * levels  … 作り終えた面（今の面と先読みした次の面だけ）。開き直したとき待たずに出すため。
 *           同じ番号からは同じ面が出るので、消えても作り直せば同じになる。
 */
export type EndlessProgress = {
  current: number;
  best: number;
  levels: Record<string, EndlessLevel>;
};

const KEY = 'snake-puzzle/endless/v1';

const EMPTY: EndlessProgress = { current: 1, best: 0, levels: {} };

export const loadEndlessProgress = async (): Promise<EndlessProgress> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<EndlessProgress>;
    const current = Number.isInteger(parsed.current) && parsed.current! >= 1 ? parsed.current! : 1;
    const best = Number.isInteger(parsed.best) ? parsed.best! : 0;
    return { current, best, levels: parsed.levels ?? {} };
  } catch {
    // 壊れていても 1 面から遊べればよい
    return EMPTY;
  }
};

/** 読んで書き換える操作を 1 本に並べる（先読みの保存とクリアの記録が食い合わないように）。 */
let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

const save = async (progress: EndlessProgress) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // 保存に失敗しても遊び続けられる
  }
};

/** 作り終えた面を残す。今の面と、その次の面だけを持つ。 */
export const rememberEndlessLevel = (entry: EndlessLevel): Promise<void> =>
  serial(async () => {
    const progress = await loadEndlessProgress();
    const levels: Record<string, EndlessLevel> = {};
    for (const [key, value] of Object.entries(progress.levels)) {
      const n = Number(key);
      if (n >= progress.current && n <= progress.current + 1) levels[key] = value;
    }
    if (entry.n >= progress.current && entry.n <= progress.current + 1) levels[entry.n] = entry;
    await save({ ...progress, levels });
  });

/** n 面をクリアした。次に遊ぶ面を n + 1 にする。 */
export const recordEndlessClear = (n: number): Promise<EndlessProgress> =>
  serial(async () => {
    const progress = await loadEndlessProgress();
    const current = Math.max(progress.current, n + 1);
    const levels: Record<string, EndlessLevel> = {};
    for (const [key, value] of Object.entries(progress.levels)) {
      const k = Number(key);
      if (k >= current && k <= current + 1) levels[key] = value;
    }
    const next = { current, best: Math.max(progress.best, n), levels };
    await save(next);
    return next;
  });

/** テスト用。次に遊ぶ面の番号を n にする（記録の最大値は変えない）。 */
export const setEndlessCurrentForTesting = (n: number): Promise<void> =>
  serial(async () => {
    const progress = await loadEndlessProgress();
    await save({ ...progress, current: Math.max(1, n), levels: {} });
  });

export const clearEndlessProgress = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
};
