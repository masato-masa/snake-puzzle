import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import { WoodSign } from '@/components/wood-sign';
import { displayName, getLevel, LEVELS, worldOf } from '@/levels/levels';
import { TILE_IMAGES } from '@/lib/tile-images';
import { colors, ui } from '@/theme';

type Props = {
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
  /** 右下の小さな「テスト用」ボタンを押したとき。 */
  onOpenTest: () => void;
};

/**
 * ステージ選択のホーム画面。中央の大きなタイルをタップすると一覧（StagePath）が
 * かぶさって開く。一覧でステージを選ぶとこの画面に反映されるだけで、
 * 実際にプレイが始まるのは「プレイ」ボタンを押したときだけ。
 */
export function StageHub({
  levelId,
  streak,
  onPlay,
  onOpenList,
  onOpenDaily,
  onOpenTest,
}: Props) {
  const level = getLevel(levelId) ?? LEVELS[0];
  const world = worldOf(level.id);
  const theme = world?.theme ?? 'meadow';

  return (
    <SkyBackground theme={theme}>
      <View style={styles.root}>
        <WoodSign eyebrow={world?.name ?? ''} title={displayName(level)} />
        <DifficultyMeter level={level.difficulty ?? 1} />

        <Pressable
          onPress={onOpenList}
          style={({ pressed }) => [styles.tileWrap, pressed && styles.tileWrapPressed]}>
          <Image source={TILE_IMAGES[theme]} resizeMode="contain" style={styles.tileImage} />
        </Pressable>

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
        </View>

        <Pressable
          onPress={onOpenTest}
          hitSlop={8}
          style={({ pressed }) => [styles.testButton, pressed && styles.testButtonPressed]}>
          <Text style={styles.testButtonText}>テスト用</Text>
        </Pressable>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
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
  testButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  testButtonPressed: {
    opacity: 0.6,
  },
  testButtonText: {
    color: colors.textOnDark,
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.8,
  },
});
