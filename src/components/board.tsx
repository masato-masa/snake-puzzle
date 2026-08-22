import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { GateTile, SandTile, SwitchTile, WarpTile } from '@/components/gimmicks';
import { GlowRing, GlowTile } from '@/components/glow-tile';
import { MOVE_DURATION, SnakeView } from '@/components/snake-view';
import {
  occupiedCells,
  openGroups,
  posKey,
  type Dir,
  type Level,
  type Pos,
  type Snake,
} from '@/engine';
import { colorForGroup, colors, mechanics, ui } from '@/theme';

type Props = {
  level: Level;
  snakes: Snake[];
  /** 1 マスの辺長（px）。呼び出し側で画面サイズから算出する。 */
  cell: number;
  selectedId?: string | null;
  interactive?: boolean;
  onSelect?: (id: string) => void;
  onDirection?: (id: string, dir: Dir) => void;
  onSettled?: (id: string) => void;
  /** ヒントで示す 1 手。 */
  hint?: { snakeId: string; dir: Dir } | null;
  /** 動けない操作をしたヘビ。値が変わるたびに「ぷるん」と反応する。 */
  bump?: { snakeId: string; token: number } | null;
  /** 直前の移動で頭が通った経路。胴体がこれをなぞる。 */
  trail?: { snakeId: string; path: Pos[]; token: number; ms: number } | null;
  /** エディタ用。指定するとマスをタップできる。 */
  onCellPress?: (pos: Pos) => void;
};

/** 盤面の描画。行数・列数は level の値に従うので、3x3 でも 7x7 でも同じコードで描ける。 */
export function Board({
  level,
  snakes,
  cell,
  selectedId,
  interactive = true,
  onSelect,
  onDirection,
  onSettled,
  hint,
  bump,
  trail,
  onCellPress,
}: Props) {
  const covered = occupiedCells(snakes);
  const wallKeys = new Set(level.walls.map(posKey));
  const sandKeys = new Set((level.sands ?? []).map(posKey));
  const open = openGroups(level, snakes);
  const width = level.cols * cell;
  const height = level.rows * cell;
  const frame = Math.max(10, Math.round(cell * 0.28));

  const cells: Pos[] = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) cells.push({ r, c });
  }

  return (
    <View style={[styles.frame, { padding: frame, borderRadius: frame + 10 }]}>
      <View style={[styles.frameHighlight, { borderRadius: frame + 6, margin: frame * 0.28 }]} />
      <View style={[styles.floor, { width, height, borderRadius: frame * 0.7 }]}>
        {cells.map((pos) => {
          const key = posKey(pos);
          const isWall = wallKeys.has(key);
          const content = isWall ? (
            <View style={[styles.wall, { borderRadius: cell * 0.16 }]}>
              <View style={[styles.grain, { top: '32%' }]} />
              <View style={[styles.grain, { top: '62%' }]} />
            </View>
          ) : sandKeys.has(key) ? (
            <SandTile cell={cell} />
          ) : (
            <View style={[styles.tile, { borderRadius: cell * 0.14 }]} />
          );

          const style = [
            styles.cell,
            { width: cell, height: cell, left: pos.c * cell, top: pos.r * cell },
          ];

          return onCellPress ? (
            <Pressable key={key} onPress={() => onCellPress(pos)} style={style}>
              {content}
            </Pressable>
          ) : (
            <View key={key} style={style}>
              {content}
            </View>
          );
        })}

        {(level.warps ?? []).flatMap((pair, i) =>
          [pair.a, pair.b].map((pos, side) => (
            <View
              key={`w-${i}-${side}`}
              pointerEvents="none"
              style={[
                styles.overlayRing,
                { width: cell, height: cell, left: pos.c * cell, top: pos.r * cell },
              ]}>
              <WarpTile cell={cell} color={mechanics.warpPairs[i % mechanics.warpPairs.length]} />
            </View>
          )),
        )}

        {(level.switches ?? []).map((sw) => (
          <View
            key={`s-${posKey(sw.pos)}`}
            pointerEvents="none"
            style={[
              styles.overlayRing,
              { width: cell, height: cell, left: sw.pos.c * cell, top: sw.pos.r * cell },
            ]}>
            <SwitchTile
              cell={cell}
              pressed={covered.has(posKey(sw.pos))}
              color={colorForGroup(sw.group, mechanics.gateGroups)}
            />
          </View>
        ))}

        {(level.gates ?? []).map((gate) => (
          <View
            key={`g-${posKey(gate.pos)}`}
            pointerEvents="none"
            style={[
              styles.overlay,
              { width: cell, height: cell, left: gate.pos.c * cell, top: gate.pos.r * cell },
              styles.cell,
            ]}>
            <GateTile
              cell={cell}
              open={open.has(gate.group)}
              color={colorForGroup(gate.group, mechanics.gateGroups)}
            />
          </View>
        ))}

        {level.targets.map((target) => {
          const key = posKey(target.pos);
          return (
            <View
              key={`t-${key}`}
              pointerEvents="none"
              style={[
                styles.target,
                {
                  width: cell,
                  height: cell,
                  left: target.pos.c * cell,
                  top: target.pos.r * cell,
                },
              ]}>
              <GlowTile
                size={cell}
                lit={covered.has(key)}
                delay={Math.round((trail?.ms ?? MOVE_DURATION) * 0.72)}
              />
            </View>
          );
        })}

        {snakes.map((snake) => (
          <SnakeView
            key={snake.id}
            snake={snake}
            cell={cell}
            selected={selectedId === snake.id}
            showSelection={snakes.length > 1}
            interactive={interactive && !!onDirection}
            onSelect={(id) => onSelect?.(id)}
            onDirection={(id, dir) => onDirection?.(id, dir)}
            onSettled={onSettled}
            bumpToken={bump?.snakeId === snake.id ? bump.token : 0}
            trail={
              trail?.snakeId === snake.id ? { path: trail.path, token: trail.token } : null
            }
          />
        ))}

        {/* ヘビに隠れた点灯マスの縁取り。ヘビより手前に描く */}
        {level.targets.map((target) => {
          const key = posKey(target.pos);
          if (!covered.has(key)) return null;
          return (
            <View
              key={`tr-${key}`}
              pointerEvents="none"
              style={[
                styles.litRing,
                { width: cell, height: cell, left: target.pos.c * cell, top: target.pos.r * cell },
              ]}>
              <GlowRing size={cell} />
            </View>
          );
        })}

        {hint ? <HintArrow snakes={snakes} hint={hint} cell={cell} /> : null}
      </View>
    </View>
  );
}

const ROTATION: Record<Dir, string> = {
  up: '0deg',
  right: '90deg',
  down: '180deg',
  left: '270deg',
};

/** ヒントの矢印。示された向きへ、ヘビの頭の外側でふわふわ動く。 */
function HintArrow({
  snakes,
  hint,
  cell,
}: {
  snakes: Snake[];
  hint: { snakeId: string; dir: Dir };
  cell: number;
}) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    float.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, hint]);

  const snake = snakes.find((s) => s.id === hint.snakeId);
  if (!snake) return null;

  const head = snake.body[0];
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[hint.dir];
  const size = cell * 0.2;
  const cx = head.c * cell + cell / 2 + delta[0] * cell * 0.72;
  const cy = head.r * cell + cell / 2 + delta[1] * cell * 0.72;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - size,
        top: cy - size,
        zIndex: 7,
        transform: [
          { translateX: float.interpolate({ inputRange: [0, 1], outputRange: [0, delta[0] * 6] }) },
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, delta[1] * 6] }) },
          { rotate: ROTATION[hint.dir] },
        ],
      }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size,
          borderRightWidth: size,
          borderBottomWidth: size * 1.5,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: colors.accent,
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    backgroundColor: colors.wood,
    borderWidth: ui.outline,
    borderColor: colors.woodDark,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 0,
  },
  frameHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.woodLight,
    opacity: 0.55,
  },
  floor: {
    position: 'relative',
    backgroundColor: colors.floor,
    overflow: 'hidden',
  },
  cell: {
    position: 'absolute',
    padding: 2,
  },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: colors.floorLine,
  },
  wall: {
    flex: 1,
    backgroundColor: colors.wood,
    borderWidth: 2,
    borderColor: colors.woodDark,
    overflow: 'hidden',
  },
  grain: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.woodGrain,
  },
  target: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  overlay: {
    position: 'absolute',
    zIndex: 1,
  },
  /** スイッチとワープ穴は輪だけなので、光るマスより上に出しても中身を隠さない。 */
  overlayRing: {
    position: 'absolute',
    zIndex: 3,
  },
  /** ヘビより手前（zIndex 6 が最大）に出す、点灯マスの縁取り。 */
  litRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
});
