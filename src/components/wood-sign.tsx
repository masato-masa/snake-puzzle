import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, ui } from '@/theme';

const WOOD_SIGN = require('@/assets/images/ui/wood-sign.png');

type Props = {
  /** 小さく上に出す一言（章名など）。省略すると出さない。 */
  eyebrow?: string;
  title: string;
  style?: StyleProp<ViewStyle>;
};

/** 木の看板に文字を乗せた見出し。ホーム画面・ステージ一覧・プレイ画面で共通で使う。 */
export function WoodSign({ eyebrow, title, style }: Props) {
  return (
    <View style={[styles.sign, style]}>
      <Image source={WOOD_SIGN} resizeMode="stretch" style={[StyleSheet.absoluteFill, styles.signImage]} />
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    position: 'relative',
    paddingVertical: 10,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 3 },
  },
  signImage: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    color: colors.woodDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: colors.woodDark,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
