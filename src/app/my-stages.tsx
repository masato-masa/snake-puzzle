import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import type { Level } from '@/engine';
import { deleteCustomLevel, loadCustomLevels } from '@/storage/custom-levels';
import { loadProgress, type Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

export default function MyStagesScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>({});
  const [customLevels, setCustomLevels] = useState<Level[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadProgress().then((p) => {
        if (active) setProgress(p);
      });
      loadCustomLevels().then((ls) => {
        if (active) setCustomLevels(ls);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const goToLevel = (levelId: string) =>
    router.push({ pathname: '/game/[levelId]', params: { levelId } });

  return (
    <SkyBackground theme="meadow">
      <BackButton onPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
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
                  style={({ pressed }) => [styles.card, pressed && { marginTop: 3, borderBottomWidth: 2 }]}>
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
                      {record?.cleared ? `じこベスト ${record.bestMoves} 手` : 'まだクリアしてない'}
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
  );
}

const styles = StyleSheet.create({
  pageContent: {
    padding: 18,
    paddingTop: 56,
    paddingBottom: 48,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
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
