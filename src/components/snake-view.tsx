import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';

import { bodyAfterPath, isAdjacent, posEq, type Dir, type Pos, type Snake } from '@/engine';
import { bodyTrack, segmentCells } from '@/lib/snake-track';
import { skinFor, type SnakeSkin } from '@/theme';

/** 直前の移動で頭が通ったマス。胴体がこの軌跡をなぞる。 */
export type Trail = { path: Pos[]; token: number };

type Props = {
  snake: Snake;
  cell: number;
  selected: boolean;
  /** 複数匹いるときだけ選択状態を見せる。 */
  showSelection: boolean;
  interactive: boolean;
  onSelect: (id: string) => void;
  onDirection: (id: string, dir: Dir) => void;
  /** 移動アニメーションが終わった時に呼ぶ。クリア演出のタイミング合わせに使う。 */
  onSettled?: (id: string) => void;
  /** 値が変わるたびに「ぷるん」と縮む。動けない操作のフィードバック。 */
  bumpToken?: number;
  trail?: Trail | null;
};

export const MOVE_DURATION = 180;

/** 進んだマス数に応じて時間を伸ばす。1 マスはきびきび、長い滑走はやや長めに。 */
export const moveDurationFor = (steps: number): number =>
  Math.min(430, 100 + 58 * Math.max(1, steps));

type Facing = 'up' | 'down' | 'left' | 'right';
type Point = { x: number; y: number };

/**
 * 移動の 1 コマ。
 * track は「旧尻尾 → 旧頭 → 通過マス…」と並べた、ヘビが通る道すじ全体。
 * steps は頭が進んだマス数で、各体節はこの道すじを steps マス分ぶん前へ進む。
 */
type Frames = { from: Pos[]; to: Pos[]; track: Pos[] | null; steps: number };

/** 体を描くパーツ。丸い体節と、体節どうしをつなぐ四角。 */
type Piece = {
  key: string;
  /** 時間順の通過点。少なくとも 2 点。 */
  points: Point[];
  size: number;
  radius: number;
  isHead: boolean;
};

const facingOf = (body: Pos[]): Facing => {
  if (body.length < 2) return 'right';
  const [head, neck] = body;
  if (head.r < neck.r) return 'up';
  if (head.r > neck.r) return 'down';
  if (head.c < neck.c) return 'left';
  return 'right';
};

/** 頭は大きく、尻尾に向かって細くする。 */
const sizeAt = (i: number, last: number, cell: number): number => {
  const body = cell * 0.78;
  if (i === 0) return cell * 0.94;
  if (last === 0) return body;
  if (i === last) return body * 0.58;
  if (i === last - 1) return body * 0.82;
  return body;
};

const centerOf = (p: Pos, cell: number): Point => ({
  x: p.c * cell + cell / 2,
  y: p.r * cell + cell / 2,
});

const midPoints = (a: Point[], b: Point[]): Point[] =>
  a.map((p, i) => ({ x: (p.x + b[i].x) / 2, y: (p.y + b[i].y) / 2 }));

/**
 * 各体節がたどる通過点を出す。
 *
 * track がある場合は「頭が通った道すじ」をそのまま使うので、
 * 曲がり角でも斜めに突っ切らず、頭に引っぱられて胴体が同じ道を通る。
 */
const trackPoints = (frames: Frames, index: number, cell: number): Point[] => {
  const { from, to, track, steps } = frames;

  if (!track || steps <= 0) {
    return [centerOf(from[index] ?? to[index], cell), centerOf(to[index], cell)];
  }

  const cells = segmentCells(track, from.length, index, steps);
  if (cells.length < 2) {
    return [centerOf(from[index] ?? to[index], cell), centerOf(to[index], cell)];
  }
  return cells.map((p) => centerOf(p, cell));
};

const buildPieces = (frames: Frames, cell: number): Piece[] => {
  const last = frames.to.length - 1;
  const tracks = frames.to.map((_p, i) => trackPoints(frames, i, cell));
  const pieces: Piece[] = [];

  // つなぎを先に、体節を後に描く（頭が一番上に来るように）
  for (let i = 0; i < last; i++) {
    // ワープでちぎれている区間はつながない
    if (!isAdjacent(frames.from[i], frames.from[i + 1])) continue;
    if (!isAdjacent(frames.to[i], frames.to[i + 1])) continue;

    const size = Math.min(sizeAt(i, last, cell), sizeAt(i + 1, last, cell));
    pieces.push({
      key: `l${i}`,
      points: midPoints(tracks[i], tracks[i + 1]),
      size,
      radius: size * 0.3,
      isHead: false,
    });
  }

  for (let i = last; i >= 0; i--) {
    const size = sizeAt(i, last, cell);
    pieces.push({
      key: `s${i}`,
      points: tracks[i],
      size,
      radius: size / 2,
      isHead: i === 0,
    });
  }

  return pieces;
};

/**
 * 通過点を Animated.interpolate 用の配列にする。
 * ワープでマスが飛ぶ区間は、直前まで留まってからパッと移動させる（盤面を横切らせない）。
 */
const rangesOf = (points: Point[], cell: number) => {
  const input: number[] = [0];
  const xs: number[] = [points[0].x];
  const ys: number[] = [points[0].y];
  const span = 1 / (points.length - 1);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const t = i * span;
    const jumped =
      Math.abs(current.x - prev.x) > cell * 1.05 || Math.abs(current.y - prev.y) > cell * 1.05;

    if (jumped) {
      input.push(t - span * 0.12);
      xs.push(prev.x);
      ys.push(prev.y);
    }
    input.push(t);
    xs.push(current.x);
    ys.push(current.y);
  }

  return { input, xs, ys };
};

/**
 * ヘビ 1 匹の描画とドラッグ操作。
 * 体のどこを掴んでも、指を動かした向きにそのヘビが進む。
 */
export function SnakeView({
  snake,
  cell,
  selected,
  showSelection,
  interactive,
  onSelect,
  onDirection,
  onSettled,
  bumpToken = 0,
  trail,
}: Props) {
  const progress = useRef(new Animated.Value(1)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const prevBody = useRef<Pos[]>(snake.body);
  const [frames, setFrames] = useState<Frames>({
    from: snake.body,
    to: snake.body,
    track: null,
    steps: 0,
  });

  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const trailRef = useRef(trail);
  trailRef.current = trail;

  useEffect(() => {
    if (prevBody.current === snake.body) return;
    const from = prevBody.current;
    prevBody.current = snake.body;

    // 長さが変わることは無いが、万一のときはアニメーションを飛ばす
    if (from.length !== snake.body.length) {
      setFrames({ from: snake.body, to: snake.body, track: null, steps: 0 });
      progress.setValue(1);
      return;
    }

    // 渡された経路がこの移動のものか確かめてから使う（Undo などでは使わない）
    const path = trailRef.current?.path ?? [];
    const usable =
      path.length > 0 &&
      bodyAfterPath(from, path).every((p, i) => posEq(p, snake.body[i]));

    const track = usable ? bodyTrack(from, path) : null;
    const steps = usable ? path.length : 0;

    setFrames({ from, to: snake.body, track, steps });
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: usable ? moveDurationFor(steps) : MOVE_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) settledRef.current?.(snake.id);
    });
  }, [snake.body, snake.id, progress]);

  useEffect(() => {
    if (!bumpToken) return;
    Animated.sequence([
      Animated.timing(bump, {
        toValue: 0.86,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(bump, {
        toValue: 1,
        friction: 3.2,
        tension: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bumpToken, bump]);

  // PanResponder は生成時のクロージャを保持するので、最新のハンドラは ref 経由で呼ぶ
  const handlers = useRef({ onSelect, onDirection, cell, interactive, id: snake.id });
  handlers.current = { onSelect, onDirection, cell, interactive, id: snake.id };
  const fired = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => handlers.current.interactive,
        onMoveShouldSetPanResponder: (_e, g) =>
          handlers.current.interactive && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderGrant: () => {
          fired.current = false;
          handlers.current.onSelect(handlers.current.id);
        },
        onPanResponderMove: (_e, g) => {
          if (fired.current) return;
          const threshold = handlers.current.cell * 0.35;
          if (Math.abs(g.dx) < threshold && Math.abs(g.dy) < threshold) return;

          const dir: Dir =
            Math.abs(g.dx) > Math.abs(g.dy)
              ? g.dx > 0
                ? 'right'
                : 'left'
              : g.dy > 0
                ? 'down'
                : 'up';
          fired.current = true;
          handlers.current.onDirection(handlers.current.id, dir);
        },
        onPanResponderRelease: () => {
          fired.current = false;
        },
        onPanResponderTerminate: () => {
          fired.current = false;
        },
      }),
    [],
  );

  const skin = skinFor(snake.color);
  const facing = facingOf(frames.to);
  const outline = Math.max(2, cell * 0.055);
  const pieces = useMemo(() => buildPieces(frames, cell), [frames, cell]);

  const transformFor = (piece: Piece, size: number) => {
    const { input, xs, ys } = rangesOf(piece.points, cell);
    const offset = size / 2;
    return [
      {
        translateX: progress.interpolate({
          inputRange: input,
          outputRange: xs.map((x) => x - offset),
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: input,
          outputRange: ys.map((y) => y - offset),
        }),
      },
      { scale: bump },
    ];
  };

  return (
    <>
      {/* 1 パス目: 輪郭。全パーツを一度に描くので、体の外周だけが線に見える */}
      {pieces.map((piece) => {
        const size = piece.size + outline * 2;
        return (
          <Animated.View
            key={`o-${piece.key}`}
            pointerEvents="none"
            style={[
              styles.piece,
              {
                width: size,
                height: size,
                borderRadius: piece.radius + outline,
                backgroundColor: skin.dark,
                transform: transformFor(piece, size),
                zIndex: 4,
              },
            ]}
          />
        );
      })}

      {/* 2 パス目: 本体 */}
      {pieces.map((piece) => (
        <Animated.View
          key={`f-${piece.key}`}
          {...responder.panHandlers}
          style={[
            styles.piece,
            {
              width: piece.size,
              height: piece.size,
              borderRadius: piece.radius,
              backgroundColor: skin.body,
              transform: transformFor(piece, piece.size),
              zIndex: piece.isHead ? 6 : 5,
            },
          ]}>
          {piece.isHead ? (
            <HeadFace
              size={piece.size}
              facing={facing}
              skin={skin}
              highlighted={showSelection && selected}
            />
          ) : null}
        </Animated.View>
      ))}
    </>
  );
}

function HeadFace({
  size,
  facing,
  skin,
  highlighted,
}: {
  size: number;
  facing: Facing;
  skin: SnakeSkin;
  highlighted: boolean;
}) {
  const eye = size * 0.34;
  const pupil = eye * 0.52;
  const shine = pupil * 0.42;
  const cheek = size * 0.2;

  // 進行方向の側に目を寄せる
  const near = 0.62;
  const far = 0.38;
  const spread = 0.24;

  const horizontal = facing === 'left' || facing === 'right';
  const along = facing === 'right' || facing === 'down' ? near : far;

  const eyeCenters = horizontal
    ? [
        { x: along, y: 0.5 - spread },
        { x: along, y: 0.5 + spread },
      ]
    : [
        { x: 0.5 - spread, y: along },
        { x: 0.5 + spread, y: along },
      ];

  const cheekCenters = horizontal
    ? [
        { x: along - 0.2, y: 0.5 - spread - 0.08 },
        { x: along - 0.2, y: 0.5 + spread + 0.08 },
      ]
    : [
        { x: 0.5 - spread - 0.08, y: along - 0.2 },
        { x: 0.5 + spread + 0.08, y: along - 0.2 },
      ];

  const shift = { x: 0, y: 0 };
  if (facing === 'right') shift.x = pupil * 0.3;
  if (facing === 'left') shift.x = -pupil * 0.3;
  if (facing === 'down') shift.y = pupil * 0.3;
  if (facing === 'up') shift.y = -pupil * 0.3;

  return (
    <>
      {/* 頭のてっぺんのつや */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.2,
          top: size * 0.12,
          width: size * 0.34,
          height: size * 0.2,
          borderRadius: size * 0.17,
          backgroundColor: skin.light,
          opacity: 0.5,
        }}
      />

      {highlighted ? (
        <View
          style={{
            position: 'absolute',
            left: -3,
            top: -3,
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            borderWidth: 2.5,
            borderColor: 'rgba(255,255,255,0.95)',
          }}
        />
      ) : null}

      {cheekCenters.map((c, i) => (
        <View
          key={`c${i}`}
          style={{
            position: 'absolute',
            left: size * c.x - cheek / 2,
            top: size * c.y - cheek / 2,
            width: cheek,
            height: cheek * 0.72,
            borderRadius: cheek / 2,
            backgroundColor: 'rgba(255, 122, 150, 0.4)',
          }}
        />
      ))}

      {eyeCenters.map((c, i) => (
        <View
          key={`e${i}`}
          style={{
            position: 'absolute',
            left: size * c.x - eye / 2,
            top: size * c.y - eye / 2,
            width: eye,
            height: eye,
            borderRadius: eye / 2,
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: skin.dark,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              width: pupil,
              height: pupil,
              borderRadius: pupil / 2,
              backgroundColor: '#26301F',
              transform: [{ translateX: shift.x }, { translateY: shift.y }],
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={{
                position: 'absolute',
                left: pupil * 0.12,
                top: pupil * 0.12,
                width: shine,
                height: shine,
                borderRadius: shine / 2,
                backgroundColor: '#FFFFFF',
                opacity: 0.9,
              }}
            />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
