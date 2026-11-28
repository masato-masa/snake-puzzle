import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, ui } from '@/theme';

type Props = {
  moves: number;
  parMoves?: number;
  canUndo: boolean;
  onUndo: () => void;
  onReset: () => void;
  onHint?: () => void;
  hintLabel?: string;
};

export function HUD({
  moves,
  parMoves,
  canUndo,
  onUndo,
  onReset,
  onHint,
  hintLabel = 'ヒント',
}: Props) {
  return (
    <View style={styles.container}>
      {/* 数字は 1 枚の板にまとめる（2 枚の箱を並べると、ボタンと合わせて箱が 5 つになって散らかる）。 */}
      <View style={styles.stats}>
        <Stat label="てすう" value={`${moves}`} />
        {parMoves !== undefined ? <View style={styles.statDivider} /> : null}
        {parMoves !== undefined ? <Stat label="さいしょう手数" value={`${parMoves}`} /> : null}
      </View>
      {/* ボタンは 1 行に等分。折り返すと行ごとに幅がばらつく。 */}
      <View style={styles.buttons}>
        <ActionButton label="1手もどす" onPress={onUndo} disabled={!canUndo} compact />
        <ActionButton label="やりなおす" onPress={onReset} compact />
        {onHint ? <ActionButton label={hintLabel} onPress={onHint} tone="primary" compact /> : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled,
  tone = 'default',
  compact,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'success';
  /** 1 行に等分して並べる用（幅を中身で決めず、親の幅を分け合う）。 */
  compact?: boolean;
}) {
  const palette =
    tone === 'primary'
      ? { bg: colors.accent, edge: colors.accentDark, text: colors.text }
      : tone === 'success'
        ? { bg: colors.success, edge: colors.successDark, text: colors.textOnDark }
        : { bg: colors.panel, edge: colors.panelBorder, text: colors.text };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.edge,
          borderBottomWidth: pressed ? 2 : 5,
          marginTop: pressed ? 3 : 0,
        },
        disabled && styles.buttonDisabled,
      ]}>
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 6,
    ...ui.shadow,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  statDivider: {
    width: 2,
    alignSelf: 'stretch',
    marginVertical: 2,
    backgroundColor: colors.panelBorder,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 1,
  },
  buttons: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 440,
    gap: 8,
  },
  buttonCompact: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonLabelCompact: {
    fontSize: 14,
  },
  button: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 11,
    paddingHorizontal: 18,
    minWidth: 104,
    alignItems: 'center',
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
});
