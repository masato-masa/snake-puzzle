import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { starCount } from '@/components/clear-overlay';
import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import type { Level } from '@/engine';
import { displayName, getLevelIndex, isLevelUnlocked, LEVELS, worldOf, type WorldTheme } from '@/levels/levels';
import { TILE_IMAGES } from '@/lib/tile-images';
import type { Progress } from '@/storage/progress';
import { colors, ui } from '@/theme';

/** クリア済みの成績（できばえ★の数）をメダルの色に変える。★3=金、★2=銀、★1=銅。 */
type Medal = 'gold' | 'silver' | 'bronze';

const medalFor = (level: Level, progress: Progress): Medal | null => {
  const record = progress[level.id];
  if (!record?.cleared) return null;
  const stars = starCount(record.bestMoves, level.parMoves);
  return stars >= 3 ? 'gold' : stars === 2 ? 'silver' : 'bronze';
};

/** ふち・番号バッジの色。 */
const MEDAL_BORDER: Record<'locked' | 'current' | Medal, string> = {
  locked: colors.metalDark,
  current: colors.gemTealDark,
  gold: colors.medalGoldDark,
  silver: colors.medalSilverDark,
  bronze: colors.medalBronzeDark,
};

const NODE_SIZE = 64;
const NODE_GAP = 34;
const NODE_HEIGHT = NODE_SIZE + NODE_GAP;
const FOCUS_SCALE = 1.3;
/** 中央からこの距離（px）離れると等倍まで戻る。中央に近いほど連続的に拡大する。 */
const SCALE_RANGE = NODE_HEIGHT * 1.4;
const PATH_THICKNESS = 10;

const WOOD_SIGN = require('@/assets/images/ui/wood-sign.png');

/**
 * ヘッダーのおおよその高さ。listArea の onLayout は入れ子の横スクロール
 * ページの中では発火が遅れることがあるため、初期値はこの見積もりから出す
 * （onLayout が発火すれば、そこでより正確な値に補正する）。
 */
const HEADER_HEIGHT_ESTIMATE = 130;

/**
 * ステージ i の中心を画面中央に合わせるための scrollTop。
 * ノードは marginVertical: NODE_GAP/2 で並ぶので、先頭ノードの中心は
 * コンテンツ原点から NODE_GAP/2 だけ内側にある（NODE_HEIGHT/2 ではない）。
 */
const scrollYForIndex = (index: number) => index * NODE_HEIGHT + NODE_GAP / 2;

type Props = {
  progress: Progress;
  clearedCount: number;
  onSelect: (levelId: string) => void;
  /** タイル画面からかぶせて開いているときだけ渡す。戻るボタンを出す。 */
  onClose?: () => void;
};

/**
 * ステージ一覧。100 面を一直線の道として縦に並べ、画面中央に近いステージほど
 * 連続的に拡大表示する（コンベア風）。指を離してスクロールの慣性が止まったら、
 * 一番近いステージの中心が画面中央にぴったり合うよう自動でスナップする。
 * 表示は 100 → 1 の順（下ほど古い・一番下がステージ1）で、開いた瞬間は
 * 「次に遊ぶステージ」が中央に来るようにする。
 * 各ノードは章のテーマ画像（TILE_IMAGES）を丸く切り抜いたもので、
 * ふちの色でクリア状況（金/銀/銅/現在地/ロック）を示す。
 * タイル画面（StageHub）からかぶせて開く形で使うため、onClose を渡すと戻るボタンが出る。
 */
export function StagePath({ progress, clearedCount, onSelect, onClose }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const isCleared = useCallback((id: string) => !!progress[id]?.cleared, [progress]);
  const displayLevels = useMemo(() => [...LEVELS].reverse(), []);
  const continueLevel = useMemo(
    () => LEVELS.find((l) => !isCleared(l.id)) ?? LEVELS[LEVELS.length - 1],
    [isCleared],
  );

  // onLayout が(入れ子の横スクロールページの中で)発火しなくても機能するよう、
  // windowHeight からの見積もりを初期値にしておく。onLayout が発火すればより正確な値に補正する。
  const [containerHeight, setContainerHeight] = useState(() =>
    Math.max(0, windowHeight - HEADER_HEIGHT_ESTIMATE),
  );
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      displayLevels.findIndex((l) => l.id === continueLevel.id),
    ),
  );
  const scrollRef = useRef<ScrollView>(null);
  const scrolledOnce = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    if (measured > 0) setContainerHeight(measured);
  }, []);

  // 初回だけ、「次に遊ぶステージ」が画面中央に来る位置まで自動スクロールする
  useEffect(() => {
    if (containerHeight <= 0 || scrolledOnce.current) return;
    scrolledOnce.current = true;
    const index = Math.max(
      0,
      displayLevels.findIndex((l) => l.id === continueLevel.id),
    );
    scrollRef.current?.scrollTo({ y: scrollYForIndex(index), animated: false });
  }, [containerHeight, displayLevels, continueLevel]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round((y - NODE_GAP / 2) / NODE_HEIGHT);
      const clamped = Math.max(0, Math.min(displayLevels.length - 1, index));
      setFocusedIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [displayLevels.length],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: handleScroll,
      }),
    [scrollY, handleScroll],
  );

  // 慣性が止まったところで、一番近いステージの中心を画面中央にスナップさせる
  const snapToNearest = useCallback(
    (offsetY: number) => {
      const index = Math.round((offsetY - NODE_GAP / 2) / NODE_HEIGHT);
      const clamped = Math.max(0, Math.min(displayLevels.length - 1, index));
      scrollRef.current?.scrollTo({ y: scrollYForIndex(clamped), animated: true });
    },
    [displayLevels.length],
  );
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => snapToNearest(e.nativeEvent.contentOffset.y),
    [snapToNearest],
  );
  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => snapToNearest(e.nativeEvent.contentOffset.y),
    [snapToNearest],
  );

  const focusedLevel = displayLevels[focusedIndex] ?? continueLevel;
  const focusedWorld = worldOf(focusedLevel.id);
  const padding = containerHeight > 0 ? Math.max(0, containerHeight / 2 - NODE_SIZE / 2) : 0;
  const trackLength = (displayLevels.length - 1) * NODE_HEIGHT;

  return (
    <SkyBackground theme={focusedWorld?.theme ?? 'meadow'}>
      <View style={styles.ribbonWrap}>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={10} style={styles.backButton}>
            <Text style={styles.backButtonText}>← もどる</Text>
          </Pressable>
        ) : null}
        <View style={styles.ribbon}>
          <Image
            source={WOOD_SIGN}
            resizeMode="stretch"
            style={[StyleSheet.absoluteFill, styles.ribbonImage]}
          />
          <Text style={styles.ribbonEyebrow}>{focusedWorld?.name ?? ''}</Text>
          <Text style={styles.ribbonTitle}>{displayName(focusedLevel)}</Text>
        </View>
        <View style={styles.ribbonFooter}>
          <DifficultyMeter level={focusedLevel.difficulty ?? 1} showLabel={false} />
          <Text style={styles.headerProgress}>
            クリア {clearedCount} / {LEVELS.length}
          </Text>
        </View>
      </View>

      <View style={styles.listArea} onLayout={onContainerLayout}>
        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          contentContainerStyle={{ paddingVertical: padding, alignItems: 'center' }}>
          {/*
            position:absolute の子は、paddingVertical を無視して「パディング込みの外枠」の
            top:0 に置かれる（flow 側の子はパディング分だけ内側から始まる）。
            なので top には明示的に padding を足して、ノードの並びと基準点をそろえる。
          */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: padding, left: 0, right: 0, height: displayLevels.length * NODE_HEIGHT }}>
            <View style={[styles.pathTrack, { height: trackLength }]} />
          </View>
          {displayLevels.map((level, index) => (
            <StageNode
              key={level.id}
              number={getLevelIndex(level.id) + 1}
              theme={worldOf(level.id)?.theme ?? 'meadow'}
              medal={medalFor(level, progress)}
              unlocked={isLevelUnlocked(level.id, isCleared)}
              isNext={level.id === continueLevel.id}
              focused={index === focusedIndex}
              targetScrollY={scrollYForIndex(index)}
              scrollY={scrollY}
              onPress={() => onSelect(level.id)}
            />
          ))}
        </Animated.ScrollView>
      </View>
    </SkyBackground>
  );
}

const StageNode = memo(function StageNode({
  number,
  theme,
  medal,
  unlocked,
  isNext,
  focused,
  targetScrollY,
  scrollY,
  onPress,
}: {
  number: number;
  theme: WorldTheme;
  medal: Medal | null;
  unlocked: boolean;
  /** 「次に遊ぶステージ」＝クリア済みでも一番若い未クリア面。宝石色で目立たせる。 */
  isNext: boolean;
  /** 現在スクロール中で一番近いステージか。重なったときに手前へ出すためだけに使う。 */
  focused: boolean;
  /** scrollY がこの値のとき、このノードが画面中央に来る。 */
  targetScrollY: number;
  scrollY: Animated.Value;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isNext) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isNext, pulse]);

  const tone: 'locked' | 'current' | Medal = !unlocked ? 'locked' : (medal ?? 'current');
  const badgeLabel = !unlocked ? '🔒' : String(number);
  const borderColor = MEDAL_BORDER[tone];
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  // スクロール位置がこのノードの中心と画面中央に一致するほど大きくする
  const scale = scrollY.interpolate({
    inputRange: [targetScrollY - SCALE_RANGE, targetScrollY, targetScrollY + SCALE_RANGE],
    outputRange: [1, FOCUS_SCALE, 1],
    extrapolate: 'clamp',
  });

  const content = (
    <Animated.View style={[{ transform: [{ scale }] }, focused && styles.focusedNode]}>
      {isNext ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }], backgroundColor: colors.gemTeal },
          ]}
        />
      ) : null}
      <View style={styles.nodeWrap}>
        <View style={[styles.nodeRing, { borderColor }]}>
          <Image source={TILE_IMAGES[theme]} resizeMode="cover" style={styles.nodeImage} />
          {!unlocked ? <View pointerEvents="none" style={styles.lockOverlay} /> : null}
          <View pointerEvents="none" style={styles.nodeShine} />
        </View>
        <View style={[styles.numberBadge, { backgroundColor: borderColor }]}>
          <Text style={styles.numberBadgeText}>{badgeLabel}</Text>
        </View>
      </View>
    </Animated.View>
  );

  if (!unlocked) return content;

  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  ribbonWrap: {
    position: 'relative',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    position: 'absolute',
    top: 18,
    left: 16,
    zIndex: 1,
    backgroundColor: colors.panel,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  backButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  ribbon: {
    position: 'relative',
    paddingVertical: 10,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 3 },
  },
  ribbonImage: {
    width: '100%',
    height: '100%',
  },
  ribbonEyebrow: {
    color: colors.woodDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  ribbonTitle: {
    color: colors.textOnDark,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: colors.woodDark,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  ribbonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerProgress: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  listArea: {
    flex: 1,
  },
  /** ノードの列の中央を貫く、まっすぐな道。 */
  pathTrack: {
    position: 'absolute',
    top: NODE_HEIGHT / 2,
    left: '50%',
    marginLeft: -PATH_THICKNESS / 2,
    width: PATH_THICKNESS,
    borderRadius: PATH_THICKNESS / 2,
    backgroundColor: colors.medalGold,
    borderWidth: 2,
    borderColor: colors.medalGoldDark,
  },
  glow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: (NODE_SIZE + 8) / 2,
  },
  nodeWrap: {
    position: 'relative',
    width: NODE_SIZE,
    alignItems: 'center',
    marginVertical: NODE_GAP / 2,
  },
  /** スクロールで中央に来ているノードだけ、隣と重なっても手前に出す。 */
  focusedNode: {
    zIndex: 10,
  },
  nodeRing: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: colors.metalLight,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  nodeImage: {
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(40, 40, 40, 0.55)',
  },
  nodeShine: {
    position: 'absolute',
    top: '10%',
    left: '18%',
    width: '40%',
    height: '22%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  numberBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: NODE_SIZE * 0.42,
    height: NODE_SIZE * 0.42,
    borderRadius: NODE_SIZE * 0.21,
    borderWidth: 2,
    borderColor: colors.textOnDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 1 },
  },
  numberBadgeText: {
    color: colors.textOnDark,
    fontSize: 13,
    fontWeight: '900',
  },
});
