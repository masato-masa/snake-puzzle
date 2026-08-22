import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GameView } from '@/components/game-view';
import { ActionButton } from '@/components/hud';
import { SkyBackground } from '@/components/sky-background';
import type { Level } from '@/engine';
import { buildDailyLevel, todayKey } from '@/levels/daily';
import { recordDailyClear } from '@/storage/daily';
import { colors, ui } from '@/theme';

export default function DailyScreen() {
  const router = useRouter();
  const [dateKey] = useState(() => todayKey());
  const [level, setLevel] = useState<Level | null>(null);
  const [failed, setFailed] = useState(false);

  // 生成は少し重いので、ローディングを 1 フレーム見せてから走らせる
  useEffect(() => {
    const timer = setTimeout(() => {
      const built = buildDailyLevel(dateKey);
      if (built) setLevel(built);
      else setFailed(true);
    }, 30);
    return () => clearTimeout(timer);
  }, [dateKey]);

  if (!level) {
    return (
      <SkyBackground theme="night">
        <Stack.Screen options={{ title: 'きょうのもんだい' }} />
        <View style={styles.center}>
          <View style={styles.card}>
            {failed ? (
              <>
                <Text style={styles.title}>もんだいを作れませんでした</Text>
                <ActionButton label="もどる" onPress={() => router.replace('/')} />
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.title}>きょうのもんだいを{'\n'}つくっています…</Text>
              </>
            )}
          </View>
        </View>
      </SkyBackground>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: level.name }} />
      <GameView
        level={level}
        theme="night"
        onCleared={async (moves) => {
          const state = await recordDailyClear(dateKey, moves);
          return state.results[dateKey];
        }}
        clearNote="きょうのもんだい たっせい！"
        onList={() => router.replace('/')}
      />
    </>
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
    ...ui.shadow,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 22,
  },
});
