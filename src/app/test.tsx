import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { ActionButton } from '@/components/hud';
import { SkyBackground } from '@/components/sky-background';
import { unlockAllForTesting } from '@/storage/progress';
import { colors, ui } from '@/theme';

/**
 * 動作確認用の隠し画面。本番の操作導線には出さず、ホーム画面右下の
 * 小さな「テスト用」ボタンからのみたどり着ける。マイステージ（エディタで
 * 作ったカスタムステージ）もここからだけ開けるようにして、本番の操作
 * 導線からは隠す。全ステージ開放はマイステージの進行状況は変えず、
 * 標準ステージだけ一括でクリア済みにして全開放する。
 */
export default function TestScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <SkyBackground>
      <BackButton onPress={() => router.back()} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>テストツール</Text>
          <Text style={styles.note}>本番では使わない、動作確認用のボタンです。</Text>
          <ActionButton label="マイステージ" onPress={() => router.push('/my-stages')} />
          <ActionButton
            label="全ステージ開放"
            tone="primary"
            onPress={async () => {
              await unlockAllForTesting();
              setStatus('全ステージを開放しました。ホーム画面に戻ってご確認ください。');
            }}
          />
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.panelBorder,
    paddingVertical: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 14,
    maxWidth: 340,
    ...ui.shadow,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
  },
  status: {
    color: colors.successDark,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
