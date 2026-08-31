import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import { WoodSign } from '@/components/wood-sign';
import { displayName, getLevel, LEVELS, worldOf } from '@/levels/levels';
import { TILE_IMAGES } from '@/lib/tile-images';
import type { Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

type Props = {
  progress: Progress;
  clearedCount: number;
  /** ホーム画面に反映されている、いま選ばれているステージ。 */
  levelId: string;
  /** デイリー問題の連続クリア日数。 */
  streak: number;
  /** プレイボタンを押したとき。 */
  onPlay: () => void;
  /** タイルをタップしたときに、ステージ一覧をかぶせて開く。 */
  onOpenList: () => void;
  /** 「きょうのもんだい」ボタンを押したとき。 */
  onOpenDaily: () => void;
  /** 「マイステージ」ボタンを押したとき。 */
  onOpenMyStages: () => void;
};

/**
 * ステージ選択のホーム画面。中央の大きなタイルをタップすると一覧（StagePath）が
 * かぶさって開く。一覧でステージを選ぶとこの画面に反映されるだけで、
 * 実際にプレイが始まるのは「プレイ」ボタンを押したときだけ。
 */
export function StageHub({
  progress,
  clearedCount,
  levelId,
  streak,
  onPlay,
  onOpenList,
  onOpenDaily,
  onOpenMyStages,
}: Props) {
  const level = getLevel(levelId) ?? LEVELS[0];
  const world = worldOf(level.id);
  const theme = world?.theme ?? 'meadow';

  return (
    <SkyBackground theme={theme}>
      <View style={styles.root}>
        <WoodSign eyebrow={world?.name ?? ''} title={displayName(level)} />
        <View style={styles.metaRow}>
          <DifficultyMeter level={level.difficulty ?? 1} showLabel={false} />
          <Text style={styles.progress}>
            クリア {clearedCount} / {LEVELS.length}
          </Text>
        </View>

        <Pressable
          onPress={onOpenList}
          style={({ pressed }) => [styles.tileWrap, pressed && styles.tileWrapPressed]}>
          <Image source={TILE_IMAGES[theme]} resizeMode="contain" style={styles.tileImage} />
        </Pressable>
        <Text style={styles.hint}>タイルをタップしてステージをえらぶ</Text>

        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}>
          <LinearGradient
            colors={[colors.gemTealLight, colors.gemTealDark]}
            style={styles.playFace}>
            <Text style={styles.playText}>プレイ</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            onPress={onOpenDaily}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
            <Text style={styles.secondaryButtonText}>きょうのもんだい</Text>
            {streak > 0 ? (
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>{streak}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onOpenMyStages}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
            <Text style={styles.secondaryButtonText}>マイステージ</Text>
          </Pressable>
        </View>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progress: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tileWrap: {
    width: '78%',
    aspectRatio: 1,
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileWrapPressed: {
    transform: [{ scale: 0.97 }],
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  hint: {
    color: colors.textOnDark,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
  },
  playButton: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.gemTealDark,
    ...ui.shadow,
  },
  playButtonPressed: {
    marginTop: 7,
    borderBottomWidth: 3,
  },
  playFace: {
    minWidth: 168,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: {
    color: colors.textOnDark,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  secondaryRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.panelBorder,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  secondaryButtonPressed: {
    marginTop: 2,
    borderBottomWidth: 2,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  streakBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    minWidth: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadgeText: {
    color: colors.textOnDark,
    fontSize: 11,
    fontWeight: '900',
  },
});
