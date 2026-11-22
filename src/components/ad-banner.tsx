import { useCallback, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors, ui } from '@/theme';

const AD_TEXT = '広告（テスト表示）　　配信SDKを導入すると、ここに実際の広告が流れます　　';
/** 1px あたりの流れる速さ（ms）。大きいほどゆっくり流れる。 */
const MS_PER_PX = 22;

/**
 * ダミーのバナー広告。実際の広告SDK導入までのプレースホルダ。
 * 同じ文字列を隙間つきで2回並べて、片方ぶんだけ左へループさせると継ぎ目なく流れて見える。
 */
export function AdBanner() {
  const translateX = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  const onTextLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width;
      if (started.current || width <= 0) return;
      started.current = true;
      Animated.loop(
        Animated.timing(translateX, {
          toValue: -width,
          duration: width * MS_PER_PX,
          useNativeDriver: true,
        }),
      ).start();
    },
    [translateX],
  );

  return (
    <View style={styles.bar}>
      <Text style={styles.badge}>AD</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
          <Text style={styles.text} numberOfLines={1} onLayout={onTextLayout}>
            {AD_TEXT}
          </Text>
          <Text style={styles.text} numberOfLines={1}>
            {AD_TEXT}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.panel,
    borderTopWidth: 2,
    borderColor: colors.panelBorder,
    paddingHorizontal: 10,
    gap: 8,
    ...ui.shadow,
    shadowOffset: { width: 0, height: -2 },
  },
  badge: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  track: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  text: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
