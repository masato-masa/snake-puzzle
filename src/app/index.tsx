import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import { StagePath } from '@/components/stage-path';
import type { Level } from '@/engine';
import { todayKey } from '@/levels/daily';
import { LEVELS } from '@/levels/levels';
import { currentStreak, loadDaily, type DailyState } from '@/storage/daily';
import { deleteCustomLevel, loadCustomLevels } from '@/storage/custom-levels';
import { loadProgress, type Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

const PAGE_COUNT = 3;

export default function StageSelectScreen() {
  const router = useRouter();
  const window = useWindowDimensions();
  /**
   * 静的書き出し（SSG）したページは、初回描画時点では実際のウィンドウサイズを
   * 知らない。useWindowDimensions がハイドレーション後に正しい値へ更新される保証がなく、
   * 0×0 のまま固まって画面が真っ白になることがあったため、実測レイアウト（onLayout）を
   * 正として使い、useWindowDimensions は初期値の見積もりにとどめる。
   */
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const { width, height } = size;
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState<Progress>({});
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [customLevels, setCustomLevels] = useState<Level[]>([]);
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
      loadCustomLevels().then((ls) => {
        if (active) setCustomLevels(ls);
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

  const goToLevel = (levelId: string) =>
    router.push({ pathname: '/game/[levelId]', params: { levelId } });

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(Math.max(0, Math.min(PAGE_COUNT - 1, index)));
  };

  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setSize({ width: w, height: h });
  };

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {width === 0 || height === 0 ? null : (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.pager}>
        <View style={{ width, height }}>
          <StagePath progress={progress} clearedCount={clearedCount} onSelect={goToLevel} />
        </View>

        <View style={{ width, height }}>
          <SkyBackground theme="night">
            <View style={styles.pageContent}>
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
            </View>
          </SkyBackground>
        </View>

        <View style={{ width, height }}>
          <SkyBackground theme="meadow">
            <ScrollView
              contentContainerStyle={styles.pageContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.world}>
                <View style={styles.worldHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.worldName}>マイステージ</Text>
                    <Text style={styles.worldSubtitle}>エディタで作った自分だけのステージ</Text>
                  </View>
                  <Text style={styles.worldCount}>{customLevels.length}</Text>
                </View>

                {customLevels.length === 0 ? (
                  <Text style={styles.emptyText}>まだ作ったステージがありません</Text>
                ) : (
                  customLevels.map((level) => {
                    const record = progress[level.id];
                    return (
                      <Pressable
                        key={level.id}
                        onPress={() => goToLevel(level.id)}
                        style={({ pressed }) => [
                          styles.card,
                          pressed && { marginTop: 3, borderBottomWidth: 2 },
                        ]}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>{level.name}</Text>
                          {record?.cleared ? (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>クリア</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.metaRow}>
                          <DifficultyMeter level={level.difficulty ?? 1} />
                          <Text style={styles.cardMeta}>
                            {level.rows}×{level.cols}・ヘビ {level.snakes.length} ひき
                            {level.parMoves ? `・さいしょう ${level.parMoves} 手` : ''}
                          </Text>
                        </View>

                        <View style={styles.customRow}>
                          <Text style={styles.cardBest}>
                            {record?.cleared
                              ? `じこベスト ${record.bestMoves} 手`
                              : 'まだクリアしてない'}
                          </Text>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              deleteCustomLevel(level.id).then(setCustomLevels);
                            }}
                            hitSlop={8}>
                            <Text style={styles.deleteLabel}>削除</Text>
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <Pressable style={styles.editorLink} onPress={() => router.push('/editor')}>
                <Text style={styles.editorLabel}>ステージエディタ</Text>
              </Pressable>
            </ScrollView>
          </SkyBackground>
        </View>
      </ScrollView>
      )}

      <View style={styles.dots} pointerEvents="none">
        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
          <View key={i} style={[styles.dot, page === i && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pageContent: {
    padding: 18,
    paddingBottom: 48,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  dotActive: {
    backgroundColor: colors.medalGold,
    borderColor: colors.medalGoldDark,
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
  world: {
    gap: 10,
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
  emptyText: {
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
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
