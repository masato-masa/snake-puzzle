import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { WorldTheme } from '@/levels/levels';

const BACKGROUND_IMAGES: Record<WorldTheme, ImageSourcePropType> = {
  meadow: require('@/assets/images/backgrounds/meadow-grass.png'),
  desert: require('@/assets/images/backgrounds/desert.png'),
  cave: require('@/assets/images/backgrounds/cave.png'),
  ice: require('@/assets/images/backgrounds/ice.png'),
  night: require('@/assets/images/backgrounds/night.png'),
};

/** 章ごとに表情が変わる背景。子要素はこの上に重ねる。 */
export function SkyBackground({
  children,
  theme = 'meadow',
}: {
  children: React.ReactNode;
  theme?: WorldTheme;
}) {
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
