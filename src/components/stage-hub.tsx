import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SkyBackground } from '@/components/sky-background';
import { getLevelIndex, LEVELS, worldOf } from '@/levels/levels';
import type { Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

const STAGE_TILE = require('@/assets/images/ui/stage-tile.png');

type Props = {
  progress: Progress;
  clearedCount: number;
  /** 「次に遊ぶステージ」を直接プレイする。 */
  onPlay: (levelId: string) => void;
  /** タイルをタップしたときに、ステージ一覧をかぶせて開く。 */
  onOpenList: () => void;
};

/**
 * ステージ選択のトップ画面。中央の大きなタイルをタップすると一覧（StagePath）が
 * かぶさって開き、タイル下のボタンは「次に遊ぶステージ」を直接プレイする。
 */
export function StageHub({ progress, clearedCount, onPlay, onOpenList }: Props) {
  const isCleared = (id: string) => !!progress[id]?.cleared;
  const continueLevel = LEVELS.find((l) => !isCleared(l.id)) ?? LEVELS[LEVELS.length - 1];
  const world = worldOf(continueLevel.id);

  return (
    <SkyBackground theme={world?.theme ?? 'meadow'}>
      <View style={styles.root}>
        <Text style={styles.progress}>
          クリア {clearedCount} / {LEVELS.length}
        </Text>

        <Pressable
          onPress={onOpenList}
          style={({ pressed }) => [styles.tileWrap, pressed && styles.tileWrapPressed]}>
          <Image source={STAGE_TILE} resizeMode="cover" style={styles.tileImage} />
        </Pressable>
        <Text style={styles.hint}>タイルをタップしてステージをえらぶ</Text>

        <Pressable
          onPress={() => onPlay(continueLevel.id)}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}>
          <LinearGradient
            colors={[colors.gemTealLight, colors.gemTealDark]}
            style={styles.playFace}>
            <Text style={styles.playEyebrow}>{world?.name ?? ''}</Text>
            <Text style={styles.playNumber}>{getLevelIndex(continueLevel.id) + 1}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  progress: {
    position: 'absolute',
    top: 18,
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
    borderRadius: ui.radius,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.panelBorder,
    ...ui.shadow,
  },
  tileWrapPressed: {
    marginTop: 3,
    shadowOffset: { width: 0, height: 0 },
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
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playEyebrow: {
    color: colors.textOnDark,
    fontSize: 10,
    fontWeight: '900',
  },
  playNumber: {
    color: colors.textOnDark,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
});
