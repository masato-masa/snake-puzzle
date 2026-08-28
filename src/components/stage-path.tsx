import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
const PATH_THICKNESS = 10;
const PATH_DOT_SIZE = 14;
/** ドット同士のおおよその間隔（px）。道全体の長さに応じて個数を決める。 */
const PATH_DOT_SPACING = 26;

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
 * 拡大表示する。表示は 100 → 1 の順（下ほど古い・一番下がステージ1）で、
 * 開いた瞬間は「次に遊ぶステージ」が中央に来るようにする。
 * 見た目は木製の看板ヘッダー＋金属メダルのノードで、盤ゲームらしい厚みを出している。
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

  // 一直線の道。最初と最後のノード中心を結ぶ長さぶんだけ、等間隔にドットを置く。
  const trackLength = (displayLevels.length - 1) * NODE_HEIGHT;
  const pathDotTops = useMemo(() => {
    const count = Math.max(1, Math.round(trackLength / PATH_DOT_SPACING));
    return Array.from({ length: count }, (_, i) => NODE_HEIGHT / 2 + ((i + 0.5) / count) * trackLength);
  }, [trackLength]);

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
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={{ paddingVertical: padding, alignItems: 'center' }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: displayLevels.length * NODE_HEIGHT }}>
            <View style={[styles.pathTrack, { height: trackLength }]} />
            {pathDotTops.map((top, i) => (
              <View key={i} style={[styles.pathDot, { top: top - PATH_DOT_SIZE / 2 }]} />
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
  onPress,
}: {
  number: number;
  medal: Medal | null;
  unlocked: boolean;
  /** 「次に遊ぶステージ」＝クリア済みでも一番若い未クリア面。宝石色で目立たせる。 */
  isNext: boolean;
  focused: boolean;
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
  const label = !unlocked ? '🔒' : String(number);
  const gradients = MEDAL_GRADIENTS[tone];
  const textColor = !unlocked ? colors.textMuted : medal ? colors.text : colors.textOnDark;
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  const content = (
    <Animated.View style={{ transform: [{ scale }] }}>
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
        <View pointerEvents="none" style={[styles.nodeBase, { backgroundColor: MEDAL_BORDER[tone] }]} />
        <LinearGradient
          colors={gradients.rim}
          style={[styles.nodeRim, { borderColor: MEDAL_BORDER[tone] }]}>
          <LinearGradient colors={gradients.face} style={styles.nodeFace}>
            <Text style={[styles.nodeText, { color: textColor }]}>{label}</Text>
          </LinearGradient>
          <View style={styles.nodeShine} />
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
  /** 縄のドット（ビーズ）。pathTrack の上に等間隔で重ねる。 */
  pathDot: {
    position: 'absolute',
    left: '50%',
    width: PATH_DOT_SIZE,
    height: PATH_DOT_SIZE,
    marginLeft: -PATH_DOT_SIZE / 2,
    borderRadius: PATH_DOT_SIZE / 2,
    backgroundColor: colors.medalGoldDark,
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
    width: NODE_SIZE,
    alignItems: 'center',
    marginVertical: NODE_GAP / 2,
  },
  /** オーブの台座（下にのぞく四角い足）。オーブの陰に半分隠れるよう先に描く。 */
  nodeBase: {
    position: 'absolute',
    top: NODE_SIZE * 0.78,
    width: NODE_SIZE * 0.46,
    height: NODE_SIZE * 0.32,
    borderRadius: NODE_SIZE * 0.14,
  },
  nodeRim: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
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
