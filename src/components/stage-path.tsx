import { LinearGradient } from 'expo-linear-gradient';
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

import { BackButton } from '@/components/back-button';
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
type Tone = 'locked' | 'current' | Medal;

const medalFor = (level: Level, progress: Progress): Medal | null => {
  const record = progress[level.id];
  if (!record?.cleared) return null;
  const stars = starCount(record.bestMoves, level.parMoves);
  return stars >= 3 ? 'gold' : stars === 2 ? 'silver' : 'bronze';
};

/** 番号バッジのグラデーション（濃→淡→濃）。金銀銅がひと目で見分けられるよう、はっきりした色にする。 */
const BADGE_GRADIENTS: Record<Tone, [string, string, string]> = {
  locked: [colors.metalLight, colors.metal, colors.metalDark],
  current: [colors.gemTealLight, colors.gemTeal, colors.gemTealDark],
  gold: [colors.medalGoldLight, colors.medalGold, colors.medalGoldDark],
  silver: [colors.medalSilverLight, colors.medalSilver, colors.medalSilverDark],
  bronze: [colors.medalBronzeLight, colors.medalBronze, colors.medalBronzeDark],
};
/** バッジの文字色。淡い金銀は濃い文字、濃いめのバッジは白文字。 */
const BADGE_TEXT_COLOR: Record<Tone, string> = {
  locked: colors.textOnDark,
  current: colors.textOnDark,
  gold: colors.text,
  silver: colors.text,
  bronze: colors.textOnDark,
};

/** 中央から外れているときの、素の大きさ。 */
const NODE_SIZE = 100;
/** 中央に来たときの拡大率の下限・上限。実際の値は画面幅からホーム画面のタイルに近づける。 */
const MIN_FOCUS_SCALE = 1.8;
const MAX_FOCUS_SCALE = 3.2;
/** 中央のノードが最大まで拡大しても隣のノードと重ならないための余白。 */
const MIN_GAP = 40;
const GAP_MARGIN = 16;
/** 「中央」を画面の真ん中よりこれだけ上にずらす（見た目の重心が下寄りに感じるため）。 */
const CENTER_OFFSET = 48;
/** 慣性が止まったとみなすまでの無操作時間。onMomentumScrollEnd が web で発火しないことがあるための保険。 */
const SNAP_DEBOUNCE_MS = 120;
/** 指を離した後、この速さ（px/ms）を下回ったら「止まるのを待たずに」スナップを始める。 */
const SNAP_VELOCITY_THRESHOLD = 0.15;

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
  /** 開いた瞬間に中央へ持ってくるステージ。ホーム画面で選ばれていたステージを渡す。 */
  initialLevelId?: string;
};

/**
 * ステージ一覧。100 面を一直線の道として縦に並べ、画面中央（よりやや上）に来た
 * ステージだけホーム画面のタイルくらいの大きさまで拡大する（コンベア風）。指を離して
 * スクロールの慣性が止まったら、一番近いステージの中心がその位置にぴったり合うよう
 * 自動でスナップする。表示は 100 → 1 の順（下ほど古い・一番下がステージ1）で、
 * 開いた瞬間は「次に遊ぶステージ」が中央に来るようにする。一番上（ステージ100より先）
 * には「？」の空きノードを置き、続きが控えていることを示す。
 * 各ノードは章のテーマ画像（TILE_IMAGES）を、ホーム画面のタイルと同じく背景なしで
 * 切り抜いたまま表示し、右下の番号バッジの色でクリア状況（金/銀/銅/現在地/ロック）を示す。
 * タイル画面（StageHub）からかぶせて開く形で使うため、onClose を渡すと戻るボタンが出る。
 */
export function StagePath({ progress, clearedCount, onSelect, onClose, initialLevelId }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCleared = useCallback((id: string) => !!progress[id]?.cleared, [progress]);
  const displayLevels = useMemo(() => [...LEVELS].reverse(), []);
  const continueLevel = useMemo(
    () => LEVELS.find((l) => !isCleared(l.id)) ?? LEVELS[LEVELS.length - 1],
    [isCleared],
  );
  // 表示スロットは「？」ノード(0) + 実ステージ(1..displayLevels.length)。
  const totalSlots = displayLevels.length + 1;
  // 開いた瞬間に中央へ持ってくるステージ。ホーム画面で選ばれていたものを優先し、
  // 見つからなければ「次に遊ぶステージ」にする。
  const initialSlot = useMemo(() => {
    const found = initialLevelId ? displayLevels.findIndex((l) => l.id === initialLevelId) : -1;
    if (found >= 0) return found + 1;
    return Math.max(1, displayLevels.findIndex((l) => l.id === continueLevel.id) + 1);
  }, [displayLevels, initialLevelId, continueLevel]);
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
   * スロット slot の中心を「中央」（画面中央より CENTER_OFFSET 上）に合わせるための scrollTop。
   * ノードは marginVertical: nodeGap/2 で並ぶので、先頭スロットの中心はコンテンツ原点から
   * nodeGap/2 だけ内側にある（nodeHeight/2 ではない）。
   */
  const scrollYForSlot = useCallback(
    (slot: number) => slot * nodeHeight + nodeGap / 2 + CENTER_OFFSET,
    [nodeHeight, nodeGap],
  );

  // onLayout が(入れ子の横スクロールページの中で)発火しなくても機能するよう、
  // windowHeight からの見積もりを初期値にしておく。onLayout が発火すればより正確な値に補正する。
  const [containerHeight, setContainerHeight] = useState(() =>
    Math.max(0, windowHeight - HEADER_HEIGHT_ESTIMATE),
  );
  const [focusedSlot, setFocusedSlot] = useState(initialSlot);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledOnce = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 指がまだ触れているあいだ（ドラッグ中）は、遅い動きでもスナップしない。 */
  const isDraggingRef = useRef(false);
  const lastScrollRef = useRef<{ y: number; t: number } | null>(null);
  /**
   * スナップ用の scrollTo を実行中は、そのアニメーションの動き自体を
   * 「まだ遅い＝もう一度スナップが必要」と誤検知して連打しないようにする。
   * 連打するとネイティブの慣性と競合してガタつく。
   */
  const isSnappingRef = useRef(false);
  const snapClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    if (measured > 0) setContainerHeight(measured);
  }, []);

  // 初回だけ、選ばれていたステージが中央に来る位置まで自動スクロールする
  useEffect(() => {
    if (containerHeight <= 0 || scrolledOnce.current) return;
    scrolledOnce.current = true;
    scrollRef.current?.scrollTo({ y: scrollYForSlot(initialSlot), animated: false });
  }, [containerHeight, initialSlot, scrollYForSlot]);

  const snapToNearest = useCallback(
    (offsetY: number) => {
      const raw = Math.round((offsetY - nodeGap / 2 - CENTER_OFFSET) / nodeHeight);
      const clamped = Math.max(0, Math.min(totalSlots - 1, raw));
      const target = scrollYForSlot(clamped);
      // 既にほぼ目的地なら、アニメーションを起こさない（無音の再スナップで
      // ネイティブの慣性と競合させない）。
      if (Math.abs(offsetY - target) < 1) return;
      isSnappingRef.current = true;
      if (snapClearTimer.current) clearTimeout(snapClearTimer.current);
      snapClearTimer.current = setTimeout(() => {
        isSnappingRef.current = false;
      }, 400);
      scrollRef.current?.scrollTo({ y: target, animated: true });
    },
    [nodeGap, nodeHeight, scrollYForSlot, totalSlots],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const slot = Math.round((y - nodeGap / 2 - CENTER_OFFSET) / nodeHeight);
      const clamped = Math.max(0, Math.min(totalSlots - 1, slot));
      setFocusedSlot((prev) => (prev === clamped ? prev : clamped));

      // 指を離した後（ドラッグ中でない）、速さが閾値を下回ったら、慣性が止まりきるのを
      // 待たずにその場でスナップを始める。停止を待つより体感が速い。
      const now = Date.now();
      const last = lastScrollRef.current;
      lastScrollRef.current = { y, t: now };
      if (!isDraggingRef.current && !isSnappingRef.current && last) {
        const dt = now - last.t;
        const velocity = dt > 0 ? Math.abs(y - last.y) / dt : 0;
        if (velocity < SNAP_VELOCITY_THRESHOLD) {
          if (snapTimer.current) {
            clearTimeout(snapTimer.current);
            snapTimer.current = null;
          }
          snapToNearest(y);
          return;
        }
      }

      // 上の速度判定が発火しなかった場合の保険。スクロールイベントが一定時間
      // 途切れたら（＝止まった、または onMomentumScrollEnd 等が発火しない環境でも）スナップする。
      // スナップ中はそのアニメーション自身のイベントで再スケジュールしない。
      if (isSnappingRef.current) return;
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => snapToNearest(y), SNAP_DEBOUNCE_MS);
    },
    [nodeGap, nodeHeight, snapToNearest, totalSlots],
  );

  const onScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    isSnappingRef.current = false;
    lastScrollRef.current = null;
    if (snapTimer.current) {
      clearTimeout(snapTimer.current);
      snapTimer.current = null;
    }
    if (snapClearTimer.current) {
      clearTimeout(snapClearTimer.current);
      snapClearTimer.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    if (snapClearTimer.current) clearTimeout(snapClearTimer.current);
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
      isDraggingRef.current = false;
      if (snapTimer.current) {
        clearTimeout(snapTimer.current);
        snapTimer.current = null;
      }
      snapToNearest(e.nativeEvent.contentOffset.y);
    },
    [snapToNearest],
  );

  const focusedLevel = displayLevels[focusedSlot - 1];
  const focusedWorld = focusedLevel ? worldOf(focusedLevel.id) : undefined;
  const padding = containerHeight > 0 ? Math.max(0, containerHeight / 2 - NODE_SIZE / 2) : 0;
  // CENTER_OFFSET ぶん上にずらしているので、最後のスロットまで届くよう下側の余白を追加で確保する。
  const paddingBottom = padding + CENTER_OFFSET;

  return (
    <SkyBackground theme={focusedWorld?.theme ?? 'meadow'}>
      <View style={styles.ribbonWrap}>
        {onClose ? <BackButton onPress={onClose} /> : null}
        <View style={styles.ribbon}>
          <Image
            source={WOOD_SIGN}
            resizeMode="stretch"
            style={[StyleSheet.absoluteFill, styles.ribbonImage]}
          />
          <Text style={styles.ribbonEyebrow}>{focusedLevel ? (focusedWorld?.name ?? '') : 'つづきは近日'}</Text>
          <Text style={styles.ribbonTitle}>{focusedLevel ? displayName(focusedLevel) : '？？？'}</Text>
        </View>
        <View style={styles.ribbonFooter}>
          <DifficultyMeter level={focusedLevel?.difficulty ?? 1} showLabel={false} />
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
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onScrollSettled}
          onScrollEndDrag={onScrollSettled}
          contentContainerStyle={{ paddingTop: padding, paddingBottom, alignItems: 'center' }}>
          <MysteryNode
            targetScrollY={scrollYForSlot(0)}
            focusScale={focusScale}
            scaleRange={scaleRange}
            verticalMargin={nodeGap / 2}
            scrollY={scrollY}
          />
          {displayLevels.map((level, index) => (
            <StageNode
              key={level.id}
              number={getLevelIndex(level.id) + 1}
              theme={worldOf(level.id)?.theme ?? 'meadow'}
              medal={medalFor(level, progress)}
              unlocked={isLevelUnlocked(level.id, isCleared)}
              targetScrollY={scrollYForSlot(index + 1)}
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

/** まだ見ぬ、ステージ100より先のスロット。続きが控えていることを示すだけの飾り。 */
const MysteryNode = memo(function MysteryNode({
  targetScrollY,
  focusScale,
  scaleRange,
  verticalMargin,
  scrollY,
}: {
  targetScrollY: number;
  focusScale: number;
  scaleRange: number;
  verticalMargin: number;
  scrollY: Animated.Value;
}) {
  const scale = scrollY.interpolate({
    inputRange: [targetScrollY - scaleRange, targetScrollY, targetScrollY + scaleRange],
    outputRange: [1, focusScale, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[styles.nodeWrap, { marginVertical: verticalMargin }]}>
        <View style={styles.mysteryPlate}>
          <Text style={styles.mysteryText}>？</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const StageNode = memo(function StageNode({
  number,
  theme,
  medal,
  unlocked,
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
  /** scrollY がこの値のとき、このノードが中央に来る。 */
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
  const shine = useRef(new Animated.Value(0)).current;
  const tone: Tone = !unlocked ? 'locked' : (medal ?? 'current');

  useEffect(() => {
    if (tone !== 'gold') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tone, shine]);

  const badgeLabel = !unlocked ? '🔒' : String(number);
  const shineScale = shine.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const shineOpacity = shine.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  // スクロール位置がこのノードの中心と「中央」に一致するほど大きくする
  const scale = scrollY.interpolate({
    inputRange: [targetScrollY - scaleRange, targetScrollY, targetScrollY + scaleRange],
    outputRange: [1, focusScale, 1],
    extrapolate: 'clamp',
  });

  const content = (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[styles.nodeWrap, { marginVertical: verticalMargin }]}>
        <View style={styles.nodePlate}>
          <Image
            source={TILE_IMAGES[theme]}
            resizeMode="contain"
            style={[styles.nodeImage, !unlocked && styles.nodeImageLocked]}
          />
        </View>
        {tone === 'gold' ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.badgeShine,
              { opacity: shineOpacity, transform: [{ scale: shineScale }] },
            ]}
          />
        ) : null}
        <LinearGradient
          colors={BADGE_GRADIENTS[tone]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.numberBadge}>
          <Text style={[styles.numberBadgeText, { color: BADGE_TEXT_COLOR[tone] }]}>{badgeLabel}</Text>
        </LinearGradient>
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
  nodeWrap: {
    position: 'relative',
    width: NODE_SIZE,
    alignItems: 'center',
  },
  /** ホーム画面のタイルと同じく、背景なし・ふちなしで切り抜いたテーマ画像をそのまま置く。 */
  nodePlate: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nodeImage: {
    width: '100%',
    height: '100%',
  },
  /** 切り抜き画像そのものを薄くする（背景がないので、四角い暗幕は被せられない）。 */
  nodeImageLocked: {
    opacity: 0.4,
  },
  mysteryPlate: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE * 0.16,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.metalDark,
    backgroundColor: colors.metalLight,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  mysteryText: {
    color: colors.metalDark,
    fontSize: NODE_SIZE * 0.42,
    fontWeight: '900',
  },
  /** 金だけ、バッジの後ろでふわっと光を放つ。 */
  badgeShine: {
    position: 'absolute',
    right: -6 - NODE_SIZE * 0.06,
    bottom: -6 - NODE_SIZE * 0.06,
    width: NODE_SIZE * 0.34 + NODE_SIZE * 0.12,
    height: NODE_SIZE * 0.34 + NODE_SIZE * 0.12,
    borderRadius: NODE_SIZE * 0.24,
    backgroundColor: colors.medalGold,
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
    fontSize: 15,
    fontWeight: '900',
  },
});
