import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

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
      {eyebrow ? (
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
      ) : null}
      {/* 長い題は字を小さくして 1 行に収める（2 行に折り返すと看板からはみ出して、上の章名に重なる）。 */}
      <Text style={[styles.title, title.length > 12 && styles.titleLong]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    position: 'relative',
    paddingVertical: 10,
    paddingHorizontal: 34,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    // 影は付けない。背景のない View に付けると、web では枠の左と下に細い線が出る（画像自体に縁取りがある）。
  },
  signImage: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    color: colors.woodDark,
    fontSize: 12,
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
  titleLong: {
    fontSize: 15,
  },
});
