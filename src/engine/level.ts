import { isAdjacent, posEq, posKey, type Level, type Pos, type Snake } from './types';

/**
 * ステージ定義の不整合を洗い出す。空配列なら健全。
 * テスト（全ステージを一括検証）とエディタの両方から呼ぶ。
 */
export const validateLevel = (level: Level): string[] => {
  const errors: string[] = [];
  const label = `[${level.id}]`;

  if (level.rows < 1 || level.cols < 1) {
    errors.push(`${label} 盤面サイズが不正: ${level.rows}x${level.cols}`);
    return errors;
  }

  const inBounds = (p: { r: number; c: number }) =>
    p.r >= 0 && p.r < level.rows && p.c >= 0 && p.c < level.cols;

  // 盤面上の固定要素（障害物・砂・ゲート・スイッチ・ワープ穴・ターゲット）は
  // 見た目がぶつからないよう、1 マスにつき 1 種類までしか置けない。
  // 種類ごとの重複や盤外は個別にエラーにし、そのうえで「同じマスに 2 種類」も検出する。
  const occupants = new Map<string, string[]>();
  const markOccupant = (p: Pos, label2: string) => {
    const key = posKey(p);
    occupants.set(key, [...(occupants.get(key) ?? []), label2]);
  };

  const wallKeys = new Set<string>();
  for (const w of level.walls) {
    if (!inBounds(w)) errors.push(`${label} 障害物が盤外: (${w.r},${w.c})`);
    if (wallKeys.has(posKey(w))) errors.push(`${label} 障害物が重複: (${w.r},${w.c})`);
    wallKeys.add(posKey(w));
    markOccupant(w, '障害物');
  }

  const sandKeys = new Set<string>();
  for (const s of level.sands ?? []) {
    if (!inBounds(s)) errors.push(`${label} 砂マスが盤外: (${s.r},${s.c})`);
    if (sandKeys.has(posKey(s))) errors.push(`${label} 砂マスが重複: (${s.r},${s.c})`);
    sandKeys.add(posKey(s));
    markOccupant(s, '砂マス');
  }

  const gateKeys = new Set<string>();
  const gateGroups = new Set<string>();
  for (const gate of level.gates ?? []) {
    const key = posKey(gate.pos);
    if (!inBounds(gate.pos)) errors.push(`${label} ゲートが盤外: (${gate.pos.r},${gate.pos.c})`);
    if (gateKeys.has(key)) errors.push(`${label} ゲートが重複: (${gate.pos.r},${gate.pos.c})`);
    gateKeys.add(key);
    gateGroups.add(gate.group);
    markOccupant(gate.pos, 'ゲート');
  }

  const switchGroups = new Set<string>();
  for (const sw of level.switches ?? []) {
    if (!inBounds(sw.pos)) errors.push(`${label} スイッチが盤外: (${sw.pos.r},${sw.pos.c})`);
    switchGroups.add(sw.group);
    markOccupant(sw.pos, 'スイッチ');
  }
  for (const group of gateGroups) {
    if (!switchGroups.has(group))
      errors.push(`${label} group "${group}" のゲートに対応するスイッチがない`);
  }
  for (const group of switchGroups) {
    if (!gateGroups.has(group))
      errors.push(`${label} group "${group}" のスイッチに対応するゲートがない`);
  }

  const warpKeys = new Set<string>();
  for (const pair of level.warps ?? []) {
    for (const p of [pair.a, pair.b] as Pos[]) {
      const key = posKey(p);
      if (!inBounds(p)) errors.push(`${label} ワープ穴が盤外: (${p.r},${p.c})`);
      if (warpKeys.has(key)) errors.push(`${label} ワープ穴が重複: (${p.r},${p.c})`);
      warpKeys.add(key);
      markOccupant(p, 'ワープ穴');
    }
    if (posEq(pair.a, pair.b))
      errors.push(`${label} ワープ穴のペアが同じマス: (${pair.a.r},${pair.a.c})`);
  }

  const targetKeys = new Set<string>();
  for (const t of level.targets) {
    if (!inBounds(t.pos)) errors.push(`${label} ターゲットが盤外: (${t.pos.r},${t.pos.c})`);
    if (targetKeys.has(posKey(t.pos)))
      errors.push(`${label} ターゲットが重複: (${t.pos.r},${t.pos.c})`);
    targetKeys.add(posKey(t.pos));
    markOccupant(t.pos, 'ターゲット');
  }

  // 盤の見やすさのため、1 マスに 2 種類以上の要素を重ねない
  // （光るマスがスイッチの絵に隠れる、砂の模様が見えない、といった事態を防ぐ）
  for (const [key, labels] of occupants) {
    if (labels.length < 2) continue;
    const [r, c] = key.split(',').map(Number);
    errors.push(`${label} 1 マスに複数の要素が重なる: (${r},${c}) [${labels.join('・')}]`);
  }

  if (level.snakes.length === 0) errors.push(`${label} ヘビが 1 匹もいない`);

  const idSeen = new Set<string>();
  const occupied = new Set<string>();
  for (const s of level.snakes) {
    if (idSeen.has(s.id)) errors.push(`${label} ヘビ id が重複: ${s.id}`);
    idSeen.add(s.id);

    if (s.body.length === 0) {
      errors.push(`${label} ヘビ ${s.id} の体が空`);
      continue;
    }
    const selfKeys = new Set<string>();
    s.body.forEach((p, i) => {
      if (!inBounds(p)) errors.push(`${label} ヘビ ${s.id} が盤外: (${p.r},${p.c})`);
      if (wallKeys.has(posKey(p)))
        errors.push(`${label} ヘビ ${s.id} が障害物と重なる: (${p.r},${p.c})`);
      if (gateKeys.has(posKey(p)))
        errors.push(`${label} ヘビ ${s.id} がゲートの上から始まっている: (${p.r},${p.c})`);
      if (selfKeys.has(posKey(p)))
        errors.push(`${label} ヘビ ${s.id} の体が自己重複: (${p.r},${p.c})`);
      selfKeys.add(posKey(p));
      if (occupied.has(posKey(p)))
        errors.push(`${label} ヘビ ${s.id} が他のヘビと重なる: (${p.r},${p.c})`);
      occupied.add(posKey(p));
      if (i > 0 && !isAdjacent(s.body[i - 1], p))
        errors.push(`${label} ヘビ ${s.id} の体が繋がっていない: 体節 ${i - 1} と ${i}`);
    });
  }

  // 現行ルールの中核: ターゲットをはみ出さずぴったり覆えるように総量を一致させる。
  const totalLength = level.snakes.reduce((sum, s) => sum + s.body.length, 0);
  if (totalLength !== level.targets.length) {
    errors.push(
      `${label} ヘビの長さ合計 (${totalLength}) とターゲット数 (${level.targets.length}) が不一致`,
    );
  }

  if (level.clearRule === 'matchColor') {
    const lengthByGroup = new Map<string, number>();
    for (const s of level.snakes) {
      if (s.group === undefined) continue;
      lengthByGroup.set(s.group, (lengthByGroup.get(s.group) ?? 0) + s.body.length);
    }
    const targetsByGroup = new Map<string, number>();
    for (const t of level.targets) {
      if (t.group === undefined) continue;
      targetsByGroup.set(t.group, (targetsByGroup.get(t.group) ?? 0) + 1);
    }
    for (const [group, count] of targetsByGroup) {
      if ((lengthByGroup.get(group) ?? 0) !== count) {
        errors.push(
          `${label} group "${group}" のヘビ長合計 (${lengthByGroup.get(group) ?? 0}) とターゲット数 (${count}) が不一致`,
        );
      }
    }
  }

  return errors;
};

export const assertValidLevel = (level: Level): void => {
  const errors = validateLevel(level);
  if (errors.length > 0) throw new Error(errors.join('\n'));
};

/** 探索の重複判定に使う正規化キー。ヘビ id 順に体をすべて並べる。 */
export const stateKey = (snakes: Snake[]): string =>
  [...snakes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((s) => `${s.id}:${s.body.map(posKey).join('|')}`)
    .join(';');
