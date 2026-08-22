import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Props = {
  size: number;
  /** ヘビに覆われたら true。 */
  lit: boolean;
  /** ヘビの移動アニメーションに合わせるための遅延（ms）。 */
  delay?: number;
};

/**
 * 埋めるべきマス。ふだんはゆっくり明滅し、覆われた瞬間に光が弾ける。
 * 「集めるアイテム」ではなく「点灯させるパネル」として見せている。
 */
export function GlowTile({ size, lit, delay = 0 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (lit) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lit, pulse]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!lit) return;

    flash.setValue(0);
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(flash, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [lit, delay, flash]);

  const plate = size * 0.66;
  const core = plate * 0.42;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/* 点灯した瞬間に外へ広がる光 */}
      <Animated.View
        style={[
          styles.flash,
          {
            width: plate,
            height: plate,
            borderRadius: plate * 0.34,
            opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [
              { scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.9, 2.2] }) },
            ],
          },
        ]}
      />

      <Animated.View
        style={{
          width: plate,
          height: plate,
          borderRadius: plate * 0.3,
          borderWidth: 2,
          borderColor: colors.glowEdge,
          backgroundColor: colors.glowSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        }}>
        {/* 中央のきらめき。ひし形にして「光っている」感じを出す */}
        <Animated.View
          style={{
            width: core,
            height: core,
            borderRadius: core * 0.28,
            backgroundColor: colors.glowCore,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
            transform: [
              { rotate: '45deg' },
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
            ],
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    position: 'absolute',
    backgroundColor: colors.glow,
  },
});

/**
 * 点灯マスにヘビが乗っているときだけ出す縁取り。
 * ヘビの本体（円）はマスの角までは届かないので、マスいっぱいの太い縁取りにすれば
 * ヘビの下からはみ出して見える。ヘビより手前（zIndex 上位）に描くので、
 * 乗っている間も「ここが点灯している」がひと目でわかる。
 */
export function GlowRing({ size }: { size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ring = size * 0.98;
  const border = Math.max(2.5, size * 0.075);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: ring,
        height: ring,
        borderRadius: size * 0.2,
        borderWidth: border,
        borderColor: colors.glowEdge,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
      }}
    />
  );
}
