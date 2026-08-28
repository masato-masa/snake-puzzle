import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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

import { starCount } from '@/components/clear-overlay';
import { DifficultyMeter } from '@/components/difficulty-meter';
import { SkyBackground } from '@/components/sky-background';
import type { Level } from '@/engine';
import { displayName, getLevelIndex, isLevelUnlocked, LEVELS, worldOf } from '@/levels/levels';
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

/** メダルの色ごとの、ふち（濃い外側）と面（明るい内側）のグラデーション。 */
const MEDAL_GRADIENTS: Record<'locked' | 'current' | Medal, { rim: [string, string]; face: [string, string] }> = {
  locked: { rim: [colors.metalLight, colors.metalDark], face: [colors.metalLight, colors.metal] },
  current: { rim: [colors.gemTealLight, colors.gemTealDark], face: [colors.gemTealLight, colors.gemTealDark] },
  gold: { rim: [colors.medalGoldLight, colors.medalGoldDark], face: [colors.medalGoldLight, colors.medalGold] },
  silver: {
    rim: [colors.medalSilverLight, colors.medalSilverDark],
    face: [colors.medalSilverLight, colors.medalSilver],
  },
  bronze: {
    rim: [colors.medalBronzeLight, colors.medalBronzeDark],
    face: [colors.medalBronzeLight, colors.medalBronze],
  },
};
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
const NEXT_SCALE = 1.15;
/** トロフィーロードのつづら折り。4 マス周期で 中央→右→中央→左 と振る。 */
const ZIGZAG_AMPLITUDE = 46;
const ZIGZAG_CYCLE = [0, 1, 0, -1];
const offsetForIndex = (index: number) => ZIGZAG_CYCLE[index % ZIGZAG_CYCLE.length] * ZIGZAG_AMPLITUDE;
const PATH_THICKNESS = 10;

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
};

/**
 * ステージ選択のメインページ。100 面をつづら折りの一本道として縦に並べ、
 * 画面中央に来たステージだけ拡大表示する。表示は 100 → 1 の順（下ほど古い・
 * 一番下がステージ1）で、開いた瞬間は「次に遊ぶステージ」が中央に来るようにする。
 * 見た目は木製の看板ヘッダー＋金属メダルのノードで、盤ゲームらしい厚みを出している。
 */
export function StagePath({ progress, clearedCount, onSelect }: Props) {
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
    scrollRef.current?.scrollTo({ y: index * NODE_HEIGHT, animated: false });
  }, [containerHeight, displayLevels, continueLevel]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const index = Math.round(y / NODE_HEIGHT);
      const clamped = Math.max(0, Math.min(displayLevels.length - 1, index));
      setFocusedIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [displayLevels.length],
  );

  const focusedLevel = displayLevels[focusedIndex] ?? continueLevel;
  const focusedWorld = worldOf(focusedLevel.id);
  const padding = containerHeight > 0 ? Math.max(0, containerHeight / 2 - NODE_SIZE / 2) : 0;

  // つづら折りの道すじ（ノードとノードの間を結ぶ、傾いた線分）を一度だけ計算する。
  const pathSegments = useMemo(() => {
    const segments: { top: number; offset: number; width: number; rotateDeg: number }[] = [];
    for (let i = 0; i < displayLevels.length - 1; i++) {
      const yA = i * NODE_HEIGHT + NODE_HEIGHT / 2;
      const yB = (i + 1) * NODE_HEIGHT + NODE_HEIGHT / 2;
      const xA = offsetForIndex(i);
      const xB = offsetForIndex(i + 1);
      const dx = xB - xA;
      const dy = yB - yA;
      const length = Math.hypot(dx, dy);
      const rotateDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      segments.push({ top: (yA + yB) / 2, offset: (xA + xB) / 2, width: length, rotateDeg });
    }
    return segments;
  }, [displayLevels.length]);

  return (
    <SkyBackground theme={focusedWorld?.theme ?? 'meadow'}>
      <View style={styles.ribbonWrap}>
        <View style={styles.ribbonRow}>
          <View style={styles.flagLeft} />
          <LinearGradient
            colors={[colors.woodLight, colors.wood, colors.woodDark]}
            locations={[0, 0.5, 1]}
            style={styles.ribbon}>
            <Text style={styles.ribbonEyebrow}>{focusedWorld?.name ?? ''}</Text>
            <Text style={styles.ribbonTitle}>{displayName(focusedLevel)}</Text>
          </LinearGradient>
          <View style={styles.flagRight} />
        </View>
        <View style={styles.ribbonFooter}>
          <DifficultyMeter level={focusedLevel.difficulty ?? 1} showLabel={false} />
          <Text style={styles.headerProgress}>
            クリア {clearedCount} / {LEVELS.length}
          </Text>
        </View>
      </View>

      <View style={styles.listArea} onLayout={onContainerLayout}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={{ paddingVertical: padding, alignItems: 'center' }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: displayLevels.length * NODE_HEIGHT }}>
            {pathSegments.map((seg, i) => (
              <View
                key={i}
                style={[
                  styles.pathSegment,
                  {
                    top: seg.top - PATH_THICKNESS / 2,
                    left: '50%',
                    marginLeft: seg.offset - seg.width / 2,
                    width: seg.width,
                    transform: [{ rotate: `${seg.rotateDeg}deg` }],
                  },
                ]}
              />
            ))}
          </View>
          {displayLevels.map((level, index) => (
            <StageNode
              key={level.id}
              number={getLevelIndex(level.id) + 1}
              medal={medalFor(level, progress)}
              unlocked={isLevelUnlocked(level.id, isCleared)}
              isNext={level.id === continueLevel.id}
              focused={index === focusedIndex}
              offsetX={offsetForIndex(index)}
              onPress={() => onSelect(level.id)}
            />
          ))}
        </ScrollView>
      </View>
    </SkyBackground>
  );
}

const StageNode = memo(function StageNode({
  number,
  medal,
  unlocked,
  isNext,
  focused,
  offsetX,
  onPress,
}: {
  number: number;
  medal: Medal | null;
  unlocked: boolean;
  /** 「次に遊ぶステージ」＝クリア済みでも一番若い未クリア面。宝石色で目立たせる。 */
  isNext: boolean;
  focused: boolean;
  offsetX: number;
  onPress: () => void;
}) {
  const targetScale = focused ? FOCUS_SCALE : isNext ? NEXT_SCALE : 1;
  const scale = useRef(new Animated.Value(targetScale)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: targetScale,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [targetScale, scale]);

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
  const label = !unlocked ? '🔒' : medal ? '✓' : String(number);
  const gradients = MEDAL_GRADIENTS[tone];
  const textColor = !unlocked ? colors.textMuted : medal ? colors.text : colors.textOnDark;
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  const content = (
    <Animated.View style={{ transform: [{ translateX: offsetX }, { scale }] }}>
      {isNext ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }], backgroundColor: colors.gemTeal },
          ]}
        />
      ) : null}
      <LinearGradient
        colors={gradients.rim}
        style={[styles.nodeRim, { borderColor: MEDAL_BORDER[tone] }]}>
        <LinearGradient colors={gradients.face} style={styles.nodeFace}>
          <Text style={[styles.nodeText, { color: textColor }]}>{label}</Text>
        </LinearGradient>
        <View style={styles.nodeShine} />
      </LinearGradient>
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
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  ribbonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  ribbon: {
    borderWidth: 3,
    borderColor: colors.woodDark,
    borderBottomWidth: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 2,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 3 },
  },
  flagLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 17,
    borderBottomWidth: 17,
    borderRightWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.woodDark,
    marginTop: 3,
  },
  flagRight: {
    width: 0,
    height: 0,
    borderTopWidth: 17,
    borderBottomWidth: 17,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.woodDark,
    marginTop: 3,
  },
  ribbonEyebrow: {
    color: colors.woodLight,
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
  pathSegment: {
    position: 'absolute',
    height: PATH_THICKNESS,
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
  nodeRim: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: NODE_GAP / 2,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  nodeFace: {
    position: 'absolute',
    inset: 7,
    borderRadius: (NODE_SIZE - 14) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeShine: {
    position: 'absolute',
    top: '12%',
    left: '20%',
    width: '44%',
    height: '26%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  nodeText: {
    fontSize: 18,
    fontWeight: '900',
  },
});
