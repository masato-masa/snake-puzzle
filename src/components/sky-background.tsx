import { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { WorldTheme } from '@/levels/levels';
import { TILE_IMAGES } from '@/lib/tile-images';

const BACKGROUND_IMAGES: Record<WorldTheme, ImageSourcePropType> = {
  meadow: require('@/assets/images/backgrounds/meadow-grass.png'),
  desert: require('@/assets/images/backgrounds/desert.png'),
  cave: require('@/assets/images/backgrounds/cave.png'),
  ice: require('@/assets/images/backgrounds/ice.png'),
  night: require('@/assets/images/backgrounds/night.png'),
};

/**
 * 章の背景やタイルは 1 枚 1MB を超えることがあり、初めて表示するときだけ
 * 読み込みが間に合わず、水色のフォールバックが一瞬見えてしまう。
 * とはいえ全章ぶん（5章 × 背景+タイルで計 11MB ほど）を一度に先読みすると、
 * 今まさに表示したい章の画像と帯域を取り合ってしまい、初回表示そのものが
 * 遅くなる。そこで、今使う章だけ即座に先読みし、残りの章は少し間を置いて
 * （今の画面が落ち着いてから）バックグラウンドで先読みする。
 */
/** require() した画像は web だと文字列 URL、{uri} オブジェクトのどちらの形でも来うる。 */
const uriOf = (source: ImageSourcePropType): string | null => {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return null;
};

const preloadedThemes = new Set<WorldTheme>();
const preloadTheme = (theme: WorldTheme) => {
  if (preloadedThemes.has(theme)) return;
  preloadedThemes.add(theme);
  const bgUri = uriOf(BACKGROUND_IMAGES[theme]);
  const tileUri = uriOf(TILE_IMAGES[theme]);
  if (bgUri) Image.prefetch(bgUri);
  if (tileUri) Image.prefetch(tileUri);
};

/** 他の章ぶんの先読みは一度だけ予約する。 */
let othersScheduled = false;
const REMAINING_PRELOAD_DELAY_MS = 2000;
const scheduleRemainingPreload = () => {
  if (othersScheduled) return;
  othersScheduled = true;
  setTimeout(() => {
    (Object.keys(BACKGROUND_IMAGES) as WorldTheme[]).forEach(preloadTheme);
  }, REMAINING_PRELOAD_DELAY_MS);
};

/** 章ごとに表情が変わる背景。子要素はこの上に重ねる。 */
export function SkyBackground({
  children,
  theme = 'meadow',
}: {
  children: React.ReactNode;
  theme?: WorldTheme;
}) {
  useEffect(() => {
    preloadTheme(theme);
    scheduleRemainingPreload();
  }, [theme]);

  return (
    <View style={styles.root}>
      <Image
        source={BACKGROUND_IMAGES[theme]}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, styles.backgroundImage]}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
});
