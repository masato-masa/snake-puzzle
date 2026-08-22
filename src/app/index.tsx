import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import { todayKey } from '@/levels/daily';
import {
  displayName,
  isWorldUnlocked,
  levelsOfWorld,
  LEVELS,
  UNLOCK_RATIO,
  WORLDS,
} from '@/levels/levels';
import { currentStreak, loadDaily, type DailyState } from '@/storage/daily';
import { loadProgress, type Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

export default function StageSelectScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>({});
  const [daily, setDaily] = useState<DailyState | null>(null);
  const today = todayKey();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadProgress().then((p) => {
        if (active) setProgress(p);
      });
      loadDaily().then((d) => {
        if (active) setDaily(d);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const isCleared = (levelId: string) => !!progress[levelId]?.cleared;
  const clearedCount = LEVELS.filter((l) => isCleared(l.id)).length;
  const streak = daily ? currentStreak(daily, today) : 0;
  const dailyDone = daily?.lastClearedDate === today;

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.lead}>
          <Text style={styles.leadText}>
            ヘビをつまんではらうと、ぶつかるまで一気にすすむ。{'\n'}
            光るマスをぴったりうめて、ぜんぶ点灯させよう！
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/daily')}
          style={({ pressed }) => [
            styles.daily,
            pressed && { marginTop: 3, borderBottomWidth: 2 },
          ]}>
          <View style={styles.dailyMain}>
            <Text style={styles.dailyTitle}>きょうのもんだい</Text>
            <Text style={styles.dailySub}>
              {dailyDone ? 'クリアずみ！ もういちど遊べます' : '毎日あたらしい 1 面'}
            </Text>
          </View>
          <View style={styles.streak}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>日れんぞく</Text>
          </View>
        </Pressable>

        <View style={styles.progressPill}>
          <Text style={styles.progressText}>
            クリア {clearedCount} / {LEVELS.length}
          </Text>
        </View>

        {WORLDS.map((world, index) => {
          const levels = levelsOfWorld(world);
          const unlocked = isWorldUnlocked(index, isCleared);
          const done = levels.filter((l) => isCleared(l.id)).length;
          const needed = index === 0 ? 0 : Math.ceil(WORLDS[index - 1].levelIds.length * UNLOCK_RATIO);
          const prevDone = index === 0 ? 0 : WORLDS[index - 1].levelIds.filter(isCleared).length;

          return (
            <View key={world.id} style={styles.world}>
              <View style={styles.worldHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.worldName}>{world.name}</Text>
                  <Text style={styles.worldSubtitle}>{world.subtitle}</Text>
                </View>
                <Text style={styles.worldCount}>
                  {done} / {levels.length}
                </Text>
              </View>

              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((done / levels.length) * 100)}%` },
                  ]}
                />
              </View>

              {unlocked ? (
                levels.map((level) => {
                  const record = progress[level.id];
                  return (
                    <Pressable
                      key={level.id}
                      onPress={() =>
                        router.push({
                          pathname: '/game/[levelId]',
                          params: { levelId: level.id },
                        })
                      }
                      style={({ pressed }) => [
                        styles.card,
                        pressed && { marginTop: 3, borderBottomWidth: 2 },
                      ]}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{displayName(level)}</Text>
                        {record?.cleared ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>クリア</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.metaRow}>
                        <DifficultyMeter level={level.difficulty ?? 1} />
                        <Text style={styles.cardMeta}>
                          {level.rows}×{level.cols}・ヘビ {level.snakes.length} ひき・さいしょう{' '}
                          {level.parMoves} 手
                        </Text>
                      </View>

                      <Text style={styles.cardBest}>
                        {record?.cleared
                          ? `じこベスト ${record.bestMoves} 手`
                          : 'まだクリアしてない'}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.locked}>
                  <Text style={styles.lockedText}>
                    まえの章をあと {Math.max(0, needed - prevDone)} 面クリアするとひらきます
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {__DEV__ ? (
          <Pressable style={styles.editorLink} onPress={() => router.push('/editor')}>
            <Text style={styles.editorLabel}>ステージエディタ（開発用）</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 48,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  lead: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    padding: 14,
    ...ui.shadow,
  },
  leadText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  daily: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.glowSoft,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.glowEdge,
    padding: 14,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  dailyMain: {
    flex: 1,
  },
  dailyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  dailySub: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.75,
    marginTop: 2,
  },
  streak: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.glowEdge,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  streakNumber: {
    color: colors.glowEdge,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  streakLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  progressPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accentDark,
    paddingVertical: 5,
    paddingHorizontal: 16,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  progressText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  world: {
    gap: 10,
    marginTop: 6,
  },
  worldHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  worldName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  worldSubtitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
  },
  worldCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  bar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2,
    borderColor: colors.panelBorder,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  locked: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.panelBorder,
    padding: 16,
    alignItems: 'center',
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.panelBorder,
    padding: 14,
    gap: 6,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  badge: {
    backgroundColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: colors.textOnDark,
    fontSize: 11,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  cardBest: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  editorLink: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  editorLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
