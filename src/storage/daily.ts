import AsyncStorage from '@react-native-async-storage/async-storage';

import { nextStreak, previousKey } from '@/levels/daily';

export type DailyState = {
  /** 最後にクリアした日付キー。 */
  lastClearedDate?: string;
  /** 連続クリア日数。 */
  streak: number;
  bestStreak: number;
  /** その日の手数。 */
  results: Record<string, number>;
};

const KEY = 'snake-puzzle/daily/v1';

const EMPTY: DailyState = { streak: 0, bestStreak: 0, results: {} };

export const loadDaily = async (): Promise<DailyState> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    return { ...EMPTY, ...(parsed as DailyState) };
  } catch {
    return EMPTY;
  }
};

/**
 * その日のクリアを記録する。
 * 前日もクリアしていれば連続日数を伸ばし、間が空いていれば 1 に戻す。
 * 同じ日に 2 回クリアしても連続日数は増えない（手数だけ良い方を残す）。
 */
export const recordDailyClear = async (
  dateKey: string,
  moves: number,
): Promise<DailyState> => {
  const state = await loadDaily();

  const streak = nextStreak(state, dateKey);
  const previousMoves = state.results[dateKey];
  const next: DailyState = {
    lastClearedDate: dateKey,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    results: {
      ...state.results,
      [dateKey]: previousMoves === undefined ? moves : Math.min(previousMoves, moves),
    },
  };

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存に失敗してもプレイは続行できる
  }
  return next;
};

/** 表示用。日をまたいで途切れていたら 0 として扱う。 */
export const currentStreak = (state: DailyState, todayKeyValue: string): number => {
  if (!state.lastClearedDate) return 0;
  if (state.lastClearedDate === todayKeyValue) return state.streak;
  if (state.lastClearedDate === previousKey(todayKeyValue)) return state.streak;
  return 0;
};
