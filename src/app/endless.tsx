import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { shouldShowInterstitial } from '@/ads/ads';
import { AdInterstitial } from '@/components/ad-interstitial';
import { BackButton } from '@/components/back-button';
import { GameView } from '@/components/game-view';
import { SkyBackground } from '@/components/sky-background';
import { SoundButton } from '@/components/sound-button';
import { ENDLESS_VERSION, endlessThemeFor, type EndlessLevel } from '@/levels/endless';
import { markInput, requestEndless } from '@/lib/endless-runner';
import {
  loadEndlessProgress,
  recordEndlessClear,
  rememberEndlessLevel,
} from '@/storage/endless';
import { colors, ui } from '@/theme';

/**
 * むげんモード。面の番号から生成器で作った面を、1 面ずつ順に遊ぶ。
 * 進んだ番号は保存し、遊んでいる間に次の面を先読みしておく。
 */
export default function EndlessScreen() {
  const router = useRouter();
  /** 遊ぶ面の番号。保存を読むまでは null。 */
  const [n, setN] = useState<number | null>(null);
  const [entry, setEntry] = useState<EndlessLevel | null>(null);
  const [showAd, setShowAd] = useState(false);

  // 保存してある番号から始める
  useEffect(() => {
    let active = true;
    loadEndlessProgress().then((p) => {
      if (!active) return;
      const saved = p.levels[p.current];
      if (saved && saved.version === ENDLESS_VERSION) setEntry(saved);
      setN(p.current);
    });
    return () => {
      active = false;
    };
  }, []);

  // 番号が決まったら作る（保存済みならそのまま）。出たら次を先読みする。
  useEffect(() => {
    if (n === null) return;
    let active = true;
    const ready = entry?.n === n ? Promise.resolve(entry) : requestEndless(n, 'now');
    ready.then((e) => {
      if (!active) return;
      setEntry(e);
      rememberEndlessLevel(e);
      requestEndless(n + 1, 'idle').then((next) => {
        if (next.version === ENDLESS_VERSION) rememberEndlessLevel(next);
      });
    });
    return () => {
      active = false;
    };
    // entry は「保存済みを使えるか」の判定にだけ使う（変わるたびに作り直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const goToNext = () => {
    if (n === null) return;
    setN(n + 1);
  };

  const level = entry && entry.n === n ? entry : null;

  if (!level || n === null) {
    return (
      <SkyBackground theme={n ? endlessThemeFor(n) : 'meadow'}>
        <Stack.Screen options={{ title: 'むげん' }} />
        <BackButton onPress={() => router.back()} />
        <View style={styles.loading}>
          <View style={styles.card}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.loadingText}>
              {n ? `${n} めんを つくっています…` : 'よみこみ中…'}
            </Text>
          </View>
        </View>
      </SkyBackground>
    );
  }

  return (
    <View style={styles.screen} onTouchStart={markInput}>
      <Stack.Screen options={{ title: `むげん ${n}` }} />
      <GameView
        key={level.level.id}
        level={level.level}
        theme={level.theme}
        eyebrow="むげん"
        onCleared={async () => {
          await recordEndlessClear(n);
          return undefined;
        }}
        onNext={() => {
          if (shouldShowInterstitial()) setShowAd(true);
          else goToNext();
        }}
        nextLabel="つぎの めん"
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
      <SoundButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    ...ui.shadow,
  },
  loadingText: {
    color: colors.text,
    fontWeight: '700',
  },
});
