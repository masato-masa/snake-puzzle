import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

type Props = {
  /** analyzeLevel が出した★1〜5。 */
  level: number;
  /** ラベルを出すか（一覧では出す、狭い場所では省略）。 */
  showLabel?: boolean;
};

/**
 * ステージの「むずかしさ」を示すインジケーター。
 *
 * クリア画面の成績★（達成度、1〜3、高いほど良い）とは別物なので、
 * 同じ★記号を使うと「星の数が違う」で混乱する。そのため、ここは
 * ★ではなくダイヤ形のピップと専用の色（difficultyOn/Off）で表す。
 */
export function DifficultyMeter({ level, showLabel = true }: Props) {
  return (
    <View style={styles.row}>
      {showLabel ? <Text style={styles.label}>難易度</Text> : null}
      <View style={styles.pips}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.pip, i < level ? styles.pipOn : styles.pipOff]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  pips: {
    flexDirection: 'row',
    gap: 3,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  pipOn: {
    backgroundColor: colors.difficultyOn,
  },
  pipOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.difficultyOff,
  },
});
