import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, ui } from '@/theme';

/** 各画面共通の「戻る」ボタン。ネイティブヘッダーを使わないので、必要な画面はこれを置く。 */
export function BackButton({ onPress, label = '← もどる' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.button}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 18,
    left: 16,
    zIndex: 10,
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
});
