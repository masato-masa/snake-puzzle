import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import type { WorldTheme } from '@/levels/levels';
import { colors } from '@/theme';

const MEADOW_BACKGROUND = require('@/assets/images/backgrounds/meadow-grass.png');

const CLOUDS = [
  { top: '8%', left: '6%', size: 74, opacity: 0.9 },
  { top: '18%', left: '68%', size: 96, opacity: 0.75 },
  { top: '58%', left: '-4%', size: 62, opacity: 0.6 },
  { top: '72%', left: '76%', size: 84, opacity: 0.55 },
] as const;

const STARS = [
  { top: '7%', left: '12%', size: 4 },
  { top: '12%', left: '46%', size: 3 },
  { top: '5%', left: '78%', size: 5 },
  { top: '22%', left: '24%', size: 3 },
  { top: '18%', left: '88%', size: 4 },
  { top: '31%', left: '62%', size: 3 },
  { top: '44%', left: '8%', size: 4 },
  { top: '68%', left: '84%', size: 3 },
  { top: '80%', left: '18%', size: 4 },
  { top: '88%', left: '58%', size: 3 },
] as const;

/** 砂丘（雲の配置をそのまま流用し、色と形だけ変える）。 */
const DUNES = CLOUDS;

/** 氷のきらめき（星の配置をそのまま流用し、ひし形にして色を変える）。 */
const CRYSTALS = STARS;

const GRADIENTS: Record<WorldTheme, readonly [string, string, string]> = {
  meadow: [colors.skyTop, colors.skyMid, colors.skyBottom],
  desert: [colors.desertTop, colors.desertMid, colors.desertBottom],
  cave: [colors.caveTop, colors.caveMid, colors.caveBottom],
  ice: [colors.iceTop, colors.iceMid, colors.iceBottom],
  night: [colors.nightTop, colors.nightMid, colors.nightBottom],
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
      {theme === 'meadow' ? (
        <Image
          source={MEADOW_BACKGROUND}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, styles.meadowImage]}
        />
      ) : (
        <LinearGradient
          colors={GRADIENTS[theme]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {theme === 'desert'
        ? DUNES.map((dune, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: dune.top,
                left: dune.left,
                width: dune.size * 1.3,
                height: dune.size * 0.5,
                borderRadius: dune.size * 0.5,
                backgroundColor: colors.dune,
                opacity: dune.opacity,
              }}
            />
          ))
        : null}

      {theme === 'cave'
        ? CLOUDS.map((rock, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: rock.top,
                left: rock.left,
                width: rock.size * 1.1,
                height: rock.size * 0.6,
                borderRadius: rock.size * 0.18,
                backgroundColor: colors.caveRock,
                opacity: 0.8,
                transform: [{ rotate: i % 2 ? '6deg' : '-8deg' }],
              }}
            />
          ))
        : null}

      {theme === 'ice'
        ? CRYSTALS.map((crystal, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: crystal.top,
                left: crystal.left,
                width: crystal.size * 1.4,
                height: crystal.size * 1.4,
                backgroundColor: colors.iceCrystal,
                transform: [{ rotate: '45deg' }],
              }}
            />
          ))
        : null}

      {theme === 'night'
        ? STARS.map((star, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
                backgroundColor: colors.star,
              }}
            />
          ))
        : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  meadowImage: {
    width: '100%',
    height: '100%',
  },
});
