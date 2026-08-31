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
 * SkyBackground が最初にマウントされたタイミングで全章ぶんまとめて先読み
 * しておき、実際にその章を表示する頃には既にキャッシュ済みにしておく。
 */
/** require() した画像は web だと文字列 URL、{uri} オブジェクトのどちらの形でも来うる。 */
const uriOf = (source: ImageSourcePropType): string | null => {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return null;
};

let preloaded = false;
const preloadBackgrounds = () => {
  if (preloaded) return;
  preloaded = true;
  [...Object.values(BACKGROUND_IMAGES), ...Object.values(TILE_IMAGES)].forEach((source) => {
    const uri = uriOf(source);
    if (uri) Image.prefetch(uri);
  });
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
    preloadBackgrounds();
  }, []);

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
