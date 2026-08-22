import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GameView } from '@/components/game-view';
import { SkyBackground } from '@/components/sky-background';
import { displayName, getLevel, getNextLevel, themeOf } from '@/levels/levels';
import { recordClear } from '@/storage/progress';
import { colors } from '@/theme';

export default function GameScreen() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  const router = useRouter();
  const level = getLevel(levelId);

  if (!level) {
    return (
      <SkyBackground>
        <Stack.Screen options={{ title: 'ステージが見つかりません' }} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>ステージ「{levelId}」は存在しません。</Text>
        </View>
      </SkyBackground>
    );
  }

  const nextLevel = getNextLevel(level.id);

  return (
    <>
      <Stack.Screen options={{ title: displayName(level) }} />
      {/* level が変わったら GameView ごと作り直して状態を初期化する */}
      <GameView
        key={level.id}
        level={level}
        theme={themeOf(level.id)}
        onCleared={async (moves) => {
          const progress = await recordClear(level.id, moves);
          return progress[level.id]?.bestMoves;
        }}
        onNext={
          nextLevel
            ? () =>
                router.replace({
                  pathname: '/game/[levelId]',
                  params: { levelId: nextLevel.id },
                })
            : undefined
        }
        onList={() => router.replace('/')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    color: colors.text,
    fontWeight: '700',
  },
});
