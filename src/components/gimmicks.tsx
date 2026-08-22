import { StyleSheet, View } from 'react-native';

import { colors, mechanics } from '@/theme';

/** 踏むとその 1 マスで止まる砂の床。 */
export function SandTile({ cell }: { cell: number }) {
  const dot = Math.max(2, cell * 0.07);
  return (
    <View style={[styles.sand, { borderRadius: cell * 0.14 }]}>
      {[
        { x: 0.22, y: 0.28 },
        { x: 0.58, y: 0.2 },
        { x: 0.36, y: 0.62 },
        { x: 0.7, y: 0.58 },
      ].map((p, i) => (
        <View
          key={i}
          style={[
            styles.sandDot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              left: cell * p.x,
              top: cell * p.y,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** スイッチで開く柵。閉じている間は壁と同じ。 */
export function GateTile({
  cell,
  open,
  color,
}: {
  cell: number;
  open: boolean;
  color: { main: string; dark: string };
}) {
  if (open) {
    return (
      <View
        style={[
          styles.gateOpen,
          { borderRadius: cell * 0.16, borderColor: color.main, opacity: 0.5 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.gateClosed,
        { borderRadius: cell * 0.16, backgroundColor: color.main, borderColor: color.dark },
      ]}>
      {[0.26, 0.47, 0.68].map((x) => (
        <View
          key={x}
          style={[
            styles.bar,
            { left: cell * x, backgroundColor: color.dark, width: Math.max(2, cell * 0.07) },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * ヘビが乗っている間だけゲートを開けるスイッチ。
 * 光るマスと同じマスに置かれることがあるので、中身を隠さないリング状にしている。
 */
export function SwitchTile({
  cell,
  pressed,
  color,
}: {
  cell: number;
  pressed: boolean;
  color: { main: string; dark: string };
}) {
  const size = cell * 0.88;
  const ring = Math.max(3, cell * (pressed ? 0.13 : 0.1));
  return (
    <View style={styles.center} pointerEvents="none">
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: pressed ? color.dark : color.main,
          borderStyle: 'dashed',
        }}
      />
    </View>
  );
}

/**
 * 入るともう片方から出てくる穴。
 * こちらも中身を隠さないよう二重のリングで表す。
 */
export function WarpTile({
  cell,
  color,
}: {
  cell: number;
  color: { main: string; dark: string };
}) {
  const outer = cell * 0.9;
  const inner = cell * 0.62;
  return (
    <View style={styles.center} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: Math.max(3, cell * 0.09),
          borderColor: color.dark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: Math.max(2, cell * 0.06),
          borderColor: color.main,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sand: {
    flex: 1,
    backgroundColor: mechanics.sand,
    borderWidth: 1,
    borderColor: mechanics.sandEdge,
    overflow: 'hidden',
  },
  sandDot: {
    position: 'absolute',
    backgroundColor: mechanics.sandDot,
  },
  gateClosed: {
    flex: 1,
    borderWidth: 2,
    overflow: 'hidden',
  },
  gateOpen: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  bar: {
    position: 'absolute',
    top: '14%',
    bottom: '14%',
    borderRadius: 2,
  },
});
