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
      <View style={styles.stats}>
        <Stat label="てすう" value={`${moves}`} />
        {parMoves !== undefined ? <Stat label="さいしょう手数" value={`${parMoves}`} /> : null}
      </View>
      <View style={styles.buttons}>
        <ActionButton label="1手もどす" onPress={onUndo} disabled={!canUndo} />
        <ActionButton label="やりなおす" onPress={onReset} />
        {onHint ? <ActionButton label={hintLabel} onPress={onHint} tone="primary" /> : null}
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
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'success';
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
        {
          backgroundColor: palette.bg,
          borderColor: palette.edge,
          borderBottomWidth: pressed ? 2 : 5,
          marginTop: pressed ? 3 : 0,
        },
        disabled && styles.buttonDisabled,
      ]}>
      <Text style={[styles.buttonLabel, { color: palette.text }]}>{label}</Text>
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
    justifyContent: 'center',
    width: '100%',
    gap: 10,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    maxWidth: 220,
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...ui.shadow,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
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
