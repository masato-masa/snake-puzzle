import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Board } from '@/components/board';
import { ActionButton } from '@/components/hud';
import { SkyBackground } from '@/components/sky-background';
import {
  analyzeLevel,
  isAdjacent,
  posEq,
  solve,
  validateLevel,
  type Gate,
  type Level,
  type LevelAnalysis,
  type Pos,
  type Snake,
  type Switch,
  type WarpPair,
} from '@/engine';
import { nextCustomLevelId, saveCustomLevel } from '@/storage/custom-levels';
import { colors, snakeColors, ui } from '@/theme';

type Mode = 'wall' | 'target' | 'snake' | 'sand' | 'gate' | 'switch' | 'warp' | 'erase';

const MODES: { key: Mode; label: string }[] = [
  { key: 'target', label: '光るマス' },
  { key: 'wall', label: '障害物' },
  { key: 'snake', label: 'ヘビ' },
  { key: 'sand', label: '砂' },
  { key: 'gate', label: 'ゲート' },
  { key: 'switch', label: 'スイッチ' },
  { key: 'warp', label: 'ワープ' },
  { key: 'erase', label: '消す' },
];

/** エディタではゲートとスイッチの group は 1 種類だけ扱う。 */
const GROUP = 'g';

const PALETTE = Object.values(snakeColors);

/**
 * ステージエディタ。盤面を作って validateLevel とソルバーにかけ、
 * 「登録してあそぶ」でこの端末に保存してすぐ遊べる（ホーム画面の「マイステージ」に並ぶ）。
 * levels.ts に正式採用したい場合は、下の JSON をそのまま貼る。
 */
export default function EditorScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('target');
  const [walls, setWalls] = useState<Pos[]>([]);
  const [targets, setTargets] = useState<Pos[]>([]);
  const [snakes, setSnakes] = useState<Snake[]>([]);
  const [sands, setSands] = useState<Pos[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [warps, setWarps] = useState<WarpPair[]>([]);
  /** ワープはペアなので、1 つ目のタップを覚えておく。 */
  const [pendingWarp, setPendingWarp] = useState<Pos | null>(null);
  /**
   * 「いま体を伸ばしている途中か」。state ではなく ref にしておく。
   * 連続タップが同じレンダーにまとまっても、次のタップが古い値を読まないようにするため。
   */
  const building = useRef(false);
  const [result, setResult] = useState<string | null>(null);
  /** 直近の解析結果。JSON 出力の parMoves / difficulty に使う。 */
  const [analysis, setAnalysis] = useState<LevelAnalysis | null>(null);

  const level: Level = useMemo(
    () => ({
      id: 'draft',
      name: 'draft',
      rows,
      cols,
      walls,
      sands: sands.length ? sands : undefined,
      gates: gates.length ? gates : undefined,
      switches: switches.length ? switches : undefined,
      warps: warps.length ? warps : undefined,
      targets: targets.map((pos) => ({ pos })),
      snakes,
    }),
    [rows, cols, walls, sands, gates, switches, warps, targets, snakes],
  );

  const errors = validateLevel(level);
  const cell = Math.max(22, Math.min(46, Math.floor((Math.min(width, 520) - 40) / cols)));

  const occupied = (pos: Pos) =>
    walls.some((w) => posEq(w, pos)) ||
    targets.some((t) => posEq(t, pos)) ||
    sands.some((s) => posEq(s, pos)) ||
    gates.some((g) => posEq(g.pos, pos)) ||
    switches.some((s) => posEq(s.pos, pos)) ||
    warps.some((w) => posEq(w.a, pos) || posEq(w.b, pos)) ||
    snakes.some((s) => s.body.some((b) => posEq(b, pos)));

  const handleCellPress = (pos: Pos) => {
    setResult(null);
    setAnalysis(null);

    if (mode === 'erase') {
      setWalls((prev) => prev.filter((w) => !posEq(w, pos)));
      setTargets((prev) => prev.filter((t) => !posEq(t, pos)));
      setSands((prev) => prev.filter((s) => !posEq(s, pos)));
      setGates((prev) => prev.filter((g) => !posEq(g.pos, pos)));
      setSwitches((prev) => prev.filter((s) => !posEq(s.pos, pos)));
      setWarps((prev) => prev.filter((w) => !posEq(w.a, pos) && !posEq(w.b, pos)));
      setSnakes((prev) => prev.filter((s) => !s.body.some((b) => posEq(b, pos))));
      setPendingWarp(null);
      building.current = false;
      return;
    }

    if (mode === 'wall') {
      if (occupied(pos)) return;
      setWalls((prev) => [...prev, pos]);
      return;
    }

    if (mode === 'sand') {
      if (occupied(pos)) return;
      setSands((prev) => [...prev, pos]);
      return;
    }

    if (mode === 'gate') {
      if (occupied(pos)) return;
      setGates((prev) => [...prev, { pos, group: GROUP }]);
      return;
    }

    if (mode === 'switch') {
      if (occupied(pos)) return;
      setSwitches((prev) => [...prev, { pos, group: GROUP }]);
      return;
    }

    if (mode === 'warp') {
      if (occupied(pos)) return;
      if (!pendingWarp) {
        setPendingWarp(pos);
        return;
      }
      if (posEq(pendingWarp, pos)) {
        setPendingWarp(null);
        return;
      }
      setWarps((prev) => [...prev, { a: pendingWarp, b: pos }]);
      setPendingWarp(null);
      return;
    }

    if (mode === 'target') {
      const exists = targets.some((t) => posEq(t, pos));
      if (exists) {
        setTargets((prev) => prev.filter((t) => !posEq(t, pos)));
        return;
      }
      if (occupied(pos)) return;
      setTargets((prev) => [...prev, pos]);
      return;
    }

    // mode === 'snake': 頭から順にタップして体を伸ばす
    if (occupied(pos)) return;

    if (!building.current) {
      building.current = true;
      setSnakes((prev) => [
        ...prev,
        {
          id: String.fromCharCode(97 + prev.length),
          color: PALETTE[prev.length % PALETTE.length],
          body: [pos],
        },
      ]);
      return;
    }

    setSnakes((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const tail = last.body[last.body.length - 1];
      if (!isAdjacent(tail, pos)) return prev;
      return [...prev.slice(0, -1), { ...last, body: [...last.body, pos] }];
    });
  };

  const runSolver = () => {
    if (errors.length > 0) {
      setResult('定義にエラーがあります。先に解消してください。');
      return;
    }
    const solution = solve(level, { maxMoves: 24, maxStates: 400_000 });
    if (!solution.solved) {
      setAnalysis(null);
      setResult(
        solution.exhausted
          ? `打ち切り（${solution.visited} 状態を探索）。解けないか、24 手を超えます。`
          : `解なし（${solution.visited} 状態を探索）`,
      );
      return;
    }

    const steps = solution.moves?.map((m) => `${m.snakeId}:${m.dir}`).join(' → ');
    setAnalysis(analyzeLevel(level));
    setResult(`最少 ${solution.minMoves} 手\n${steps}`);
  };

  /** 解けることを確認したうえで保存し、そのまま遊べる画面に移動する。 */
  const registerAndPlay = async () => {
    if (errors.length > 0) {
      setResult('定義にエラーがあります。先に解消してください。');
      return;
    }
    setSaving(true);
    try {
      const solution = solve(level, { maxMoves: 24, maxStates: 400_000 });
      if (!solution.solved) {
        setAnalysis(null);
        setResult(
          solution.exhausted
            ? `打ち切り（${solution.visited} 状態を探索）。解けないか、24 手を超えます。`
            : `解なし（${solution.visited} 状態を探索）`,
        );
        return;
      }
      const freshAnalysis = analyzeLevel(level);
      setAnalysis(freshAnalysis);
      setResult(null);

      const id = nextCustomLevelId();
      await saveCustomLevel({
        ...level,
        id,
        name: name.trim() || '無題のステージ',
        parMoves: solution.minMoves ?? undefined,
        difficulty: freshAnalysis.stars,
      });
      router.push({ pathname: '/game/[levelId]', params: { levelId: id } });
    } finally {
      setSaving(false);
    }
  };

  // ソルバーは重いので JSON 生成では回さず、直近の実行結果を使う
  const json = useMemo(
    () =>
      JSON.stringify(
        {
          id: 'new-level',
          name: '新しいステージ',
          rows,
          cols,
          walls,
          sands: sands.length ? sands : undefined,
          gates: gates.length ? gates : undefined,
          switches: switches.length ? switches : undefined,
          warps: warps.length ? warps : undefined,
          targets: targets.map((pos) => ({ pos })),
          snakes,
          parMoves: analysis?.minMoves,
          difficulty: analysis?.stars,
        },
        null,
        2,
      ),
    [rows, cols, walls, sands, gates, switches, warps, targets, snakes, analysis],
  );

  const totalLength = snakes.reduce((sum, s) => sum + s.body.length, 0);

  return (
    <SkyBackground>
      <BackButton onPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Stepper label="行" value={rows} onChange={setRows} />
        <Stepper label="列" value={cols} onChange={setCols} />
      </View>

      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="ステージ名（未入力なら「無題のステージ」）"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.row}>
        {MODES.map((m) => (
          <ActionButton
            key={m.key}
            label={m.label}
            tone={mode === m.key ? 'primary' : 'default'}
            onPress={() => {
              setMode(m.key);
              building.current = false;
              setPendingWarp(null);
            }}
          />
        ))}
      </View>

      {mode === 'snake' ? (
        <View style={styles.row}>
          <Text style={styles.note}>頭から順にタップして体を伸ばす</Text>
          <ActionButton
            label="別のヘビを置く"
            onPress={() => {
              building.current = false;
            }}
          />
        </View>
      ) : null}

      {mode === 'warp' ? (
        <Text style={styles.note}>
          {pendingWarp
            ? `1 つ目を (${pendingWarp.r},${pendingWarp.c}) に置いた。つなぐ先をタップ`
            : '2 マスをタップしてペアにする'}
        </Text>
      ) : null}

      <Board level={level} snakes={snakes} cell={cell} onCellPress={handleCellPress} interactive={false} />

      <Text style={styles.summary}>
        ヘビ長さ合計 {totalLength} / ターゲット {targets.length}
      </Text>

      {errors.length > 0 ? (
        <View style={styles.errorBox}>
          {errors.map((e) => (
            <Text key={e} style={styles.errorText}>
              ・{e.replace('[draft] ', '')}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.ok}>定義は健全です</Text>
      )}

      <View style={styles.row}>
        <ActionButton label="ソルバー実行" onPress={runSolver} tone="primary" />
        <ActionButton
          label={saving ? '登録中…' : '登録してあそぶ'}
          onPress={registerAndPlay}
          tone="primary"
        />
        <ActionButton
          label="全部消す"
          onPress={() => {
            setWalls([]);
            setTargets([]);
            setSnakes([]);
            setSands([]);
            setGates([]);
            setSwitches([]);
            setWarps([]);
            setPendingWarp(null);
            building.current = false;
            setResult(null);
            setAnalysis(null);
          }}
        />
      </View>

      {result ? <Text style={styles.result}>{result}</Text> : null}

      {analysis ? (
        <View style={styles.analysisBox}>
          <Text style={styles.analysisTitle}>
            むずかしさ {analysis.stars} / 5（score {analysis.score.toFixed(1)}）
          </Text>
          <Text style={styles.analysisRow}>
            手数 {analysis.minMoves} ／ 分岐 {analysis.branching.toFixed(2)} ／ 読む量{' '}
            {analysis.searchWork.toFixed(1)}
          </Text>
          <Text style={styles.analysisRow}>
            最短解 {analysis.optimalPaths} 通り ／ 一本道 {(analysis.forcedRatio * 100).toFixed(0)}%
            ／ ミスが致命的 {(analysis.punishRate * 100).toFixed(0)}%
          </Text>
        </View>
      ) : null}

      <Text style={styles.jsonLabel}>levels.ts に貼る JSON</Text>
      <Text selectable style={styles.json}>
        {json}
      </Text>

      <Pressable style={styles.testLink} onPress={() => router.push('/test')}>
        <Text style={styles.testLinkLabel}>テストツール（全ステージ開放など）</Text>
      </Pressable>
      </ScrollView>
    </SkyBackground>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.note}>
        {label} {value}
      </Text>
      <ActionButton label="−" onPress={() => onChange(Math.max(3, value - 1))} />
      <ActionButton label="＋" onPress={() => onChange(Math.min(9, value + 1))} />
    </View>
  );
}

const panel = {
  backgroundColor: colors.panel,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: colors.panelBorder,
  width: '100%',
  maxWidth: 520,
  ...ui.shadow,
  shadowOffset: { width: 0, height: 2 },
} as const;

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 56,
    gap: 12,
    alignItems: 'center',
    paddingBottom: 60,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    ...panel,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  note: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summary: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  errorBox: {
    ...panel,
    padding: 12,
    gap: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  ok: {
    color: colors.successDark,
    fontSize: 13,
    fontWeight: '900',
  },
  result: {
    ...panel,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    padding: 10,
  },
  analysisBox: {
    ...panel,
    padding: 12,
    gap: 3,
  },
  analysisTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  analysisRow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  jsonLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  json: {
    ...panel,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    padding: 10,
  },
  testLink: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  testLinkLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
