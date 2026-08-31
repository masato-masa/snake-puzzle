import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { shouldShowInterstitial } from '@/ads/ads';
import { AdInterstitial } from '@/components/ad-interstitial';
import { BackButton } from '@/components/back-button';
import { GameView } from '@/components/game-view';
import { SkyBackground } from '@/components/sky-background';
import type { Level } from '@/engine';
import { displayName, getLevel, getNextLevel, themeOf } from '@/levels/levels';
import { getCustomLevel } from '@/storage/custom-levels';
import { recordClear } from '@/storage/progress';
import { colors } from '@/theme';

export default function GameScreen() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  const router = useRouter();
  const staticLevel = getLevel(levelId);
  /** undefined = まだカスタム保存を確認していない。null = 確認したが無かった。 */
  const [customLevel, setCustomLevel] = useState<Level | undefined | null>(undefined);

  useEffect(() => {
    if (staticLevel) return;
    let active = true;
    getCustomLevel(levelId).then((level) => {
      if (active) setCustomLevel(level ?? null);
    });
    return () => {
      active = false;
    };
  }, [levelId, staticLevel]);

  const level = staticLevel ?? customLevel ?? undefined;
  const stillLooking = !staticLevel && customLevel === undefined;

  if (!level) {
    return (
      <SkyBackground>
        <Stack.Screen options={{ title: stillLooking ? '読み込み中…' : 'ステージが見つかりません' }} />
        <BackButton onPress={() => router.back()} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>
            {stillLooking ? '読み込み中…' : `ステージ「${levelId}」は存在しません。`}
          </Text>
        </View>
      </SkyBackground>
    );
  }

  const nextLevel = getNextLevel(level.id);
  const [showAd, setShowAd] = useState(false);

  const goToNext = () => {
    if (!nextLevel) return;
    router.replace({ pathname: '/game/[levelId]', params: { levelId: nextLevel.id } });
  };

  return (
    <View style={styles.screen}>
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
            ? () => {
                if (shouldShowInterstitial()) {
                  setShowAd(true);
                } else {
                  goToNext();
                }
              }
            : undefined
        }
        onList={() => router.replace('/')}
        onBack={() => router.back()}
      />
      {showAd ? (
        <AdInterstitial
          onClose={() => {
            setShowAd(false);
            goToNext();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
