import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { WorldTheme } from '@/levels/levels';
import { colors } from '@/theme';

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

const GRADIENTS: Record<WorldTheme, readonly [string, string, string]> = {
  meadow: [colors.skyTop, colors.skyMid, colors.skyBottom],
  cave: [colors.caveTop, colors.caveMid, colors.caveBottom],
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
      <LinearGradient
        colors={GRADIENTS[theme]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {theme === 'meadow'
        ? CLOUDS.map((cloud, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.cloud,
                {
                  top: cloud.top,
                  left: cloud.left,
                  width: cloud.size,
                  height: cloud.size * 0.44,
                  borderRadius: cloud.size * 0.22,
                  opacity: cloud.opacity,
                },
              ]}>
              <View
                style={[
                  styles.puff,
                  {
                    width: cloud.size * 0.5,
                    height: cloud.size * 0.5,
                    borderRadius: cloud.size * 0.25,
                    left: cloud.size * 0.16,
                    top: -cloud.size * 0.2,
                  },
                ]}
              />
              <View
                style={[
                  styles.puff,
                  {
                    width: cloud.size * 0.38,
                    height: cloud.size * 0.38,
                    borderRadius: cloud.size * 0.19,
                    left: cloud.size * 0.5,
                    top: -cloud.size * 0.12,
                  },
                ]}
              />
            </View>
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
  cloud: {
    position: 'absolute',
    backgroundColor: colors.cloud,
  },
  puff: {
    position: 'absolute',
    backgroundColor: colors.cloud,
  },
});
