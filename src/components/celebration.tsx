import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

const PIECES = Array.from({ length: 16 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 16 + (i % 2 ? 0.2 : 0);
  return {
    angle,
    distance: 90 + (i % 4) * 26,
    size: 9 + (i % 3) * 4,
    color: [colors.glow, colors.accent, colors.success, '#5DC94F', '#A78BFA'][i % 5],
    spin: i % 2 ? 1 : -1,
  };
});

/**
 * クリアした瞬間の演出。紙吹雪と「クリア！」の文字を出す。
 * ヘビが移動しきってから mount することで、動きの途中で結果が出ないようにする。
 */
export function Celebration() {
  const burst = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(burst, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(60),
      Animated.spring(pop, { toValue: 1, friction: 4.5, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [burst, pop]);

  return (
    <View pointerEvents="none" style={styles.root}>
      {PIECES.map((piece, i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              width: piece.size,
              height: piece.size * 1.4,
              backgroundColor: piece.color,
              opacity: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                {
                  translateX: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(piece.angle) * piece.distance],
                  }),
                },
                {
                  translateY: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(piece.angle) * piece.distance + 30],
                  }),
                },
                {
                  rotate: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${piece.spin * 320}deg`],
                  }),
                },
              ],
            },
          ]}
        />
      ))}

      <Animated.View
        style={{
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '-4deg'] }) },
          ],
          opacity: pop,
        }}>
        <Text style={styles.label}>クリア！</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
  label: {
    color: colors.accent,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: colors.woodDark,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
});
