import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isBgmOn, isSfxOn, setBgmOn, setSfxOn, subscribeSound } from '@/lib/sound';
import { colors, ui } from '@/theme';

/**
 * 右上の「おと」ボタン。押すと効果音と BGM の入切が 2 行出る。
 * 音は Web だけなので、ネイティブ版では出さない。BackButton と同じ見た目・同じ高さ。
 * 画面全体に重ねて置く（背景の外）。時計の帯やノッチの分は自分で下げる。
 */
export function SoundButton() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);
  useEffect(() => subscribeSound(() => setTick((n) => n + 1)), []);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.wrap, { top: 18 + insets.top, right: 16 + insets.right }]}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={10} style={styles.button}>
        <Text style={styles.text}>♪ おと</Text>
      </Pressable>
      {open ? (
        <View style={styles.panel}>
          <Row label="効果音" on={isSfxOn()} onPress={() => setSfxOn(!isSfxOn())} />
          <Row label="BGM" on={isBgmOn()} onPress={() => setBgmOn(!isBgmOn())} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.pill, on ? styles.pillOn : null]}>
        <Text style={[styles.pillText, on ? styles.pillTextOn : null]}>{on ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 20,
    alignItems: 'flex-end',
  },
  button: {
    backgroundColor: colors.panel,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  panel: {
    marginTop: 8,
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
    ...ui.shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 6,
    minWidth: 140,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: colors.panelBorder,
  },
  pillOn: {
    backgroundColor: colors.text,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  pillTextOn: {
    color: colors.panel,
  },
});
