import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/hud';
import { colors, ui } from '@/theme';

type Props = {
  moves: number;
  parMoves?: number;
  bestMoves?: number;
  /** ヒントを使った回数。0 なら出さない。 */
  hintCount?: number;
  /** 補足の一言（デイリーの連続日数など）。 */
  note?: string;
  hasNext: boolean;
  nextLabel?: string;
  onNext: () => void;
  onRetry: () => void;
  onList: () => void;
};

export function ClearOverlay({
  moves,
  parMoves,
  bestMoves,
  hintCount = 0,
  note,
  hasNext,
  nextLabel,
  onNext,
  onRetry,
  onList,
}: Props) {
  const isPar = parMoves !== undefined && moves <= parMoves;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: enter,
            transform: [
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            ],
          },
        ]}>
        <Text style={styles.title}>クリア！</Text>

        <Text style={styles.starsLabel}>できばえ</Text>
        <View style={styles.stars}>
          {[0, 1, 2].map((i) => (
            <Text key={i} style={[styles.star, i < starCount(moves, parMoves) && styles.starOn]}>
              ★
            </Text>
          ))}
        </View>

        <Text style={styles.detail}>
          {moves} 手{parMoves !== undefined ? `（さいしょう ${parMoves} 手）` : ''}
        </Text>
        {isPar ? <Text style={styles.par}>さいしょう手数を達成！</Text> : null}
        {bestMoves !== undefined ? (
          <Text style={styles.best}>じこベスト {bestMoves} 手</Text>
        ) : null}
        {hintCount > 0 ? <Text style={styles.best}>ヒント {hintCount} 回</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.buttons}>
          {hasNext ? (
            <ActionButton label={nextLabel ?? 'つぎのステージ'} onPress={onNext} tone="primary" />
          ) : null}
          <ActionButton label="もういちど" onPress={onRetry} />
          <ActionButton label="ステージ一覧" onPress={onList} />
        </View>
      </Animated.View>
    </View>
  );
}

/** 最少手数ぴったりで 3 つ星。超えるほど減る。 */
export const starCount = (moves: number, parMoves?: number): number => {
  if (parMoves === undefined) return 3;
  if (moves <= parMoves) return 3;
  if (moves <= parMoves + 2) return 2;
  return 1;
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 60, 90, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: colors.wood,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 4,
    width: '100%',
    maxWidth: 340,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: colors.woodDark,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  starsLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  star: {
    fontSize: 30,
    color: 'rgba(122, 97, 71, 0.25)',
  },
  starOn: {
    color: colors.accent,
  },
  detail: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  par: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
  },
  best: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    color: colors.glowEdge,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  buttons: {
    marginTop: 14,
    gap: 10,
    width: '100%',
    alignItems: 'center',
  },
});
