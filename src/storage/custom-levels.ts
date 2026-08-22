import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Level } from '@/engine';

const KEY = 'snake-puzzle/custom-levels/v1';

export const loadCustomLevels = async (): Promise<Level[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Level[];
  } catch {
    // 保存データが壊れていても遊べなくならないようにする
    return [];
  }
};

export const getCustomLevel = async (id: string): Promise<Level | undefined> => {
  const levels = await loadCustomLevels();
  return levels.find((level) => level.id === id);
};

/** 登録・上書き保存。同じ id があれば置き換える。 */
export const saveCustomLevel = async (level: Level): Promise<Level[]> => {
  const levels = await loadCustomLevels();
  const next = [...levels.filter((l) => l.id !== level.id), level];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存に失敗してもこの場でのプレイは妨げない
  }
  return next;
};

export const deleteCustomLevel = async (id: string): Promise<Level[]> => {
  const levels = await loadCustomLevels();
  const next = levels.filter((l) => l.id !== id);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 何もしない
  }
  return next;
};

/** 登録のたびに一意な id を振る。 */
export const nextCustomLevelId = (): string => `custom-${Date.now()}`;
