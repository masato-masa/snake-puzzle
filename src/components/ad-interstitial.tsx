import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/hud';
import { colors, ui } from '@/theme';

const SKIP_AFTER_MS = 3000;

type Props = {
  onClose: () => void;
  title?: string;
  body?: string;
  closeLabel?: string;
};

/**
 * ダミーの広告オーバーレイ。実際の広告SDK導入までのプレースホルダ。
 * 実物の広告と同じく、数秒経つまで閉じられないようにして体感を近づけている。
 * ステージ間のインタースティシャルと、ヒント無制限解放のリワード広告の両方で使う
 * （見た目の骨格は同じで、コピーだけ呼び出し側で変える）。
 */
export function AdInterstitial({
  onClose,
  title = 'ダミー広告',
  body = 'ここに広告が表示されます。\n配信SDK導入までのプレースホルダです。',
  closeLabel = '閉じる',
}: Props) {
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.badge}>広告（テスト）</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {canSkip ? (
          <ActionButton label={closeLabel} onPress={onClose} tone="primary" />
        ) : (
          <Text style={styles.wait}>まもなくスキップできます…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 20, 30, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: colors.wood,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 6 },
  },
  badge: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
  },
  wait: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
