import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { SkyBackground } from '@/components/sky-background';
import { displayName, getLevel, LEVELS, worldOf, type WorldTheme } from '@/levels/levels';
import type { Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

const TILE_IMAGES: Record<WorldTheme, ImageSourcePropType> = {
  meadow: require('@/assets/images/tiles/meadow.png'),
  desert: require('@/assets/images/tiles/desert.png'),
  cave: require('@/assets/images/tiles/cave.png'),
  ice: require('@/assets/images/tiles/ice.png'),
  night: require('@/assets/images/tiles/night.png'),
};

const WOOD_SIGN = require('@/assets/images/ui/wood-sign.png');

type Props = {
  progress: Progress;
  clearedCount: number;
  /** ホーム画面に反映されている、いま選ばれているステージ。 */
  levelId: string;
  /** プレイボタンを押したとき。 */
  onPlay: () => void;
  /** タイルをタップしたときに、ステージ一覧をかぶせて開く。 */
  onOpenList: () => void;
};

/**
 * ステージ選択のホーム画面。中央の大きなタイルをタップすると一覧（StagePath）が
 * かぶさって開く。一覧でステージを選ぶとこの画面に反映されるだけで、
 * 実際にプレイが始まるのは「プレイ」ボタンを押したときだけ。
 */
export function StageHub({ progress, clearedCount, levelId, onPlay, onOpenList }: Props) {
  const level = getLevel(levelId) ?? LEVELS[0];
  const world = worldOf(level.id);
  const theme = world?.theme ?? 'meadow';

  return (
    <SkyBackground theme={theme}>
      <View style={styles.root}>
        <View style={styles.signWrap}>
          <Image source={WOOD_SIGN} resizeMode="stretch" style={[StyleSheet.absoluteFill, styles.signImage]} />
          <Text style={styles.signEyebrow}>{world?.name ?? ''}</Text>
          <Text style={styles.signTitle}>{displayName(level)}</Text>
        </View>
        <Text style={styles.progress}>
          クリア {clearedCount} / {LEVELS.length}
        </Text>

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
  signWrap: {
    position: 'relative',
    paddingVertical: 10,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 3 },
  },
  signImage: {
    width: '100%',
    height: '100%',
  },
  signEyebrow: {
    color: colors.woodDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  signTitle: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: colors.woodDark,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
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
});
