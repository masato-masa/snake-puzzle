import AsyncStorage from '@react-native-async-storage/async-storage';

export type LevelProgress = { cleared: boolean; bestMoves: number };
export type Progress = Record<string, LevelProgress>;

const KEY = 'snake-puzzle/progress/v1';

export const loadProgress = async (): Promise<Progress> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Progress;
  } catch {
    // 保存データが壊れていても遊べなくならないようにする
    return {};
  }
};

/** クリアを記録して、更新後の進行状況を返す。自己ベストは少ない手数を残す。 */
export const recordClear = async (levelId: string, moves: number): Promise<Progress> => {
  const progress = await loadProgress();
  const prev = progress[levelId];
  const next: Progress = {
    ...progress,
    [levelId]: {
      cleared: true,
      bestMoves: prev?.cleared ? Math.min(prev.bestMoves, moves) : moves,
    },
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存に失敗してもプレイは続行できる
  }
  return next;
};

export const clearProgress = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
};
