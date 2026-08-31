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

/** 番号バッジの色。ふちを使わなくなったので、クリア状況はこのバッジの色だけで示す。 */
const MEDAL_BORDER: Record<'locked' | 'current' | Medal, string> = {
  locked: colors.metalDark,
  current: colors.gemTealDark,
  gold: colors.medalGoldDark,
  silver: colors.medalSilverDark,
  bronze: colors.medalBronzeDark,
};

/** 中央から外れているときの、素の大きさ。 */
const NODE_SIZE = 100;
/** 中央に来たときの拡大率の下限・上限。実際の値は画面幅からホーム画面のタイルに近づける。 */
const MIN_FOCUS_SCALE = 1.8;
const MAX_FOCUS_SCALE = 3.2;
/** 中央のノードが最大まで拡大しても隣のノードと重ならないための余白。 */
const MIN_GAP = 40;
const GAP_MARGIN = 16;
const PATH_THICKNESS = 10;
/** 慣性が止まったとみなすまでの無操作時間。onMomentumScrollEnd が web で発火しないことがあるための保険。 */
const SNAP_DEBOUNCE_MS = 120;

const WOOD_SIGN = require('@/assets/images/ui/wood-sign.png');

/**
 * ヘッダーのおおよその高さ。listArea の onLayout は入れ子の横スクロール
 * ページの中では発火が遅れることがあるため、初期値はこの見積もりから出す
 * （onLayout が発火すれば、そこでより正確な値に補正する）。
 */
const HEADER_HEIGHT_ESTIMATE = 130;

type Props = {
  progress: Progress;
  clearedCount: number;
  onSelect: (levelId: string) => void;
  /** タイル画面からかぶせて開いているときだけ渡す。戻るボタンを出す。 */
  onClose?: () => void;
};

/**
 * ステージ一覧。100 面を一直線の道として縦に並べ、画面中央に来たステージだけ
 * ホーム画面のタイルくらいの大きさまで拡大する（コンベア風）。指を離してスクロールの
 * 慣性が止まったら、一番近いステージの中心が画面中央にぴったり合うよう自動でスナップする。
 * 表示は 100 → 1 の順（下ほど古い・一番下がステージ1）で、開いた瞬間は
 * 「次に遊ぶステージ」が中央に来るようにする。「次に遊ぶステージ」より先（まだ見えていない
 * 未来のステージ）へはスクロール自体ができない（handleScroll でその場に押し戻す）。
 * 各ノードは章のテーマ画像（TILE_IMAGES）を、ホーム画面のタイルと同じく背景なしで
 * 切り抜いたまま表示し、右下の番号バッジの色だけでクリア状況（金/銀/銅/現在地/ロック）を示す。
 * タイル画面（StageHub）からかぶせて開く形で使うため、onClose を渡すと戻るボタンが出る。
 */
export function StagePath({ progress, clearedCount, onSelect, onClose }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCleared = useCallback((id: string) => !!progress[id]?.cleared, [progress]);
  const displayLevels = useMemo(() => [...LEVELS].reverse(), []);
  const continueLevel = useMemo(
    () => LEVELS.find((l) => !isCleared(l.id)) ?? LEVELS[LEVELS.length - 1],
    [isCleared],
  );
  const continueIndex = useMemo(
    () => Math.max(0, displayLevels.findIndex((l) => l.id === continueLevel.id)),
    [displayLevels, continueLevel],
  );
  /** 中央に来たときの拡大率。ホーム画面の大タイル（画面幅の 72% ほど）に近づける。 */
  const focusScale = Math.min(
    MAX_FOCUS_SCALE,
    Math.max(MIN_FOCUS_SCALE, (windowWidth * 0.72) / NODE_SIZE),
  );
  // 中央のノードが focusScale まで膨らんでも隣のノードに被らないよう、
  // 実際の拡大率から逆算して間隔を決める（大きく拡大するほど間隔も広げる）。
  const nodeGap = Math.max(MIN_GAP, (NODE_SIZE * focusScale) / 2 - NODE_SIZE / 2 + GAP_MARGIN);
  const nodeHeight = NODE_SIZE + nodeGap;
  /** 中央からこの距離（px）離れると等倍まで戻る。隣のノードでは等倍になっているようにする。 */
  const scaleRange = nodeHeight * 0.9;
  /**
   * ステージ i の中心を画面中央に合わせるための scrollTop。
   * ノードは marginVertical: nodeGap/2 で並ぶので、先頭ノードの中心は
   * コンテンツ原点から nodeGap/2 だけ内側にある（nodeHeight/2 ではない）。
   */
  const scrollYForIndex = useCallback((index: number) => index * nodeHeight + nodeGap / 2, [nodeHeight, nodeGap]);

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
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continueIndexRef = useRef(continueIndex);
  continueIndexRef.current = continueIndex;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    if (measured > 0) setContainerHeight(measured);
  }, []);

  // 初回だけ、「次に遊ぶステージ」が画面中央に来る位置まで自動スクロールする
  useEffect(() => {
    if (containerHeight <= 0 || scrolledOnce.current) return;
    scrolledOnce.current = true;
    scrollRef.current?.scrollTo({ y: scrollYForIndex(continueIndex), animated: false });
  }, [containerHeight, continueIndex, scrollYForIndex]);

  // 「次に遊ぶステージ」より先（まだ見えていない未来のステージ）にはスナップさせない
  const clampIndex = useCallback(
    (index: number) => Math.max(continueIndexRef.current, Math.min(displayLevels.length - 1, index)),
    [displayLevels.length],
  );

  const snapToNearest = useCallback(
    (offsetY: number) => {
      const raw = Math.round((offsetY - nodeGap / 2) / nodeHeight);
      scrollRef.current?.scrollTo({ y: scrollYForIndex(clampIndex(raw)), animated: true });
    },
    [clampIndex, nodeGap, nodeHeight, scrollYForIndex],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;

      // 「次に遊ぶステージ」より先へは、ドラッグ中でもその場でスクロールを押し戻す
      const minY = scrollYForIndex(continueIndexRef.current);
      if (y < minY - 0.5) {
        scrollRef.current?.scrollTo({ y: minY, animated: false });
      }

      const index = Math.round((y - nodeGap / 2) / nodeHeight);
      const clamped = Math.max(0, Math.min(displayLevels.length - 1, index));
      setFocusedIndex((prev) => (prev === clamped ? prev : clamped));

      // onMomentumScrollEnd / onScrollEndDrag が発火しない環境（web で確認済み）でも
      // 確実に止まったと分かるよう、スクロールイベントが一定時間途切れたらスナップする。
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => snapToNearest(y), SNAP_DEBOUNCE_MS);
    },
    [displayLevels.length, nodeGap, nodeHeight, scrollYForIndex, snapToNearest],
  );

  useEffect(() => () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
  }, []);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: handleScroll,
      }),
    [scrollY, handleScroll],
  );

  // 対応環境では onMomentumScrollEnd / onScrollEndDrag のほうが早く確定するので、
  // 発火したときは即座にスナップし、保留中のデバウンスは打ち消す。
  const onScrollSettled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (snapTimer.current) {
        clearTimeout(snapTimer.current);
        snapTimer.current = null;
      }
      snapToNearest(e.nativeEvent.contentOffset.y);
    },
    [snapToNearest],
  );

  const focusedLevel = displayLevels[focusedIndex] ?? continueLevel;
  const focusedWorld = worldOf(focusedLevel.id);
  const padding = containerHeight > 0 ? Math.max(0, containerHeight / 2 - NODE_SIZE / 2) : 0;
  const trackLength = (displayLevels.length - 1) * nodeHeight;

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
          onMomentumScrollEnd={onScrollSettled}
          onScrollEndDrag={onScrollSettled}
          contentContainerStyle={{ paddingVertical: padding, alignItems: 'center' }}>
          {/*
            position:absolute の子は、paddingVertical を無視して「パディング込みの外枠」の
            top:0 に置かれる（flow 側の子はパディング分だけ内側から始まる）。
            なので top には明示的に padding を足して、ノードの並びと基準点をそろえる。
          */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: padding, left: 0, right: 0, height: displayLevels.length * nodeHeight }}>
            <View style={[styles.pathTrack, { top: nodeHeight / 2, height: trackLength }]} />
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
              focusScale={focusScale}
              scaleRange={scaleRange}
              verticalMargin={nodeGap / 2}
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
  focusScale,
  scaleRange,
  verticalMargin,
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
  /** 中央に来たときの拡大率（ホーム画面のタイルに近い大きさになるよう画面幅から算出）。 */
  focusScale: number;
  /** 中央からこの距離（px）離れると等倍まで戻る。 */
  scaleRange: number;
  /** ノード同士の間隔（片側ぶん）。 */
  verticalMargin: number;
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
  const badgeColor = MEDAL_BORDER[tone];
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  // スクロール位置がこのノードの中心と画面中央に一致するほど大きくする
  const scale = scrollY.interpolate({
    inputRange: [targetScrollY - scaleRange, targetScrollY, targetScrollY + scaleRange],
    outputRange: [1, focusScale, 1],
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
      <View style={[styles.nodeWrap, { marginVertical: verticalMargin }]}>
        <View style={styles.nodePlate}>
          <Image
            source={TILE_IMAGES[theme]}
            resizeMode="contain"
            style={[styles.nodeImage, !unlocked && styles.nodeImageLocked]}
          />
        </View>
        <View style={[styles.numberBadge, { backgroundColor: badgeColor }]}>
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
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: NODE_SIZE * 0.22,
  },
  nodeWrap: {
    position: 'relative',
    width: NODE_SIZE,
    alignItems: 'center',
  },
  /** スクロールで中央に来ているノードだけ、隣と重なっても手前に出す。 */
  focusedNode: {
    zIndex: 10,
  },
  /** ホーム画面のタイルと同じく、背景なし・ふちなしで切り抜いたテーマ画像をそのまま置く。 */
  nodePlate: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeImage: {
    width: '100%',
    height: '100%',
  },
  /** 切り抜き画像そのものを薄くする（背景がないので、四角い暗幕は被せられない）。 */
  nodeImageLocked: {
    opacity: 0.4,
  },
  numberBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    minWidth: NODE_SIZE * 0.34,
    height: NODE_SIZE * 0.34,
    borderRadius: NODE_SIZE * 0.17,
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
    fontSize: 15,
    fontWeight: '900',
  },
});
