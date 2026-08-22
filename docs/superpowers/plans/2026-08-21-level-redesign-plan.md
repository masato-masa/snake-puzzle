# レベル再設計（気づきの組み合わせ）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 30 面中 11 面を、既存の仕掛け（壁・砂・スイッチ/ゲート・ワープ穴・他ヘビ）を
2〜3 個組み合わせた新しいパズルに差し替え、「似た面が多い／簡単すぎる」を解消する。

**Architecture:** `src/levels/levels.ts` の `LEVELS` 配列内、該当 11 エントリの中身（id/name/
walls/targets/snakes/parMoves/difficulty/hint）を丸ごと差し替え、`WORLDS` の levelIds も
新 id に更新する。エンジン（`src/engine/`）・UI は一切変更しない。

**Tech Stack:** 既存の TypeScript レベル定義 + Jest ベースの検証ツール
（`__tests__/tools/level-simulate.test.ts`, `__tests__/tools/level-draft.test.ts`,
`__tests__/engine.test.ts`, `__tests__/tools/level-audit.test.ts`）。

**Spec:** `docs/superpowers/specs/2026-08-21-level-redesign-design.md`

## Global Constraints

- 同時に独立して動かせる駒（ヘビ）は **4〜5 匹まで**（6 匹は約 25〜30 秒で通るが 7 匹以上は
  `maxStates: 400_000` で解が見つからない実測あり）。
- 新規/変更する面は必ず `validateLevel` の「ヘビの長さ合計 = ターゲット数」を満たす
  （機構用ヘビの最終セルも必ずターゲットにする）。
- 座標は手計算で `levels.ts` に直接書かない。必ず
  `__tests__/tools/level-simulate.test.ts`（`npm run levels:simulate`）で終形を実機確認し、
  `__tests__/tools/level-draft.test.ts`（`npm run levels:draft`）で
  `solve`/`auditLevel`/`analyzeLevel`/`findSimilarLevels` が **OK**（issues 空、重複 0 組）に
  なってから `levels.ts` へ転記する。
- 各タスク完了後、使ったツールファイルの `SCENARIOS`/`DRAFTS` は空配列に戻す
  （`__tests__/tools/*.test.ts` は通常の `npm test` から除外されているが、次のタスクで
  混線しないようにするため）。
- 章バッチ（Task 群）を 1 つ終えるごとに `npx tsc --noEmit && npx jest --ci` と
  `npm run levels:audit` をフルで実行し、全 PASS ・全 OK・重複 0 組を確認してから次のバッチへ
  進む。

---

## 章 1 バッチ（4 面差し替え）

### Task 1: plus-shape-6x5 → A+E「壁で止まる仲間、もう一方は動く仲間にぶつかって止まる」

**Files:**
- Modify: `src/levels/levels.ts`（`plus-shape-6x5` エントリを差し替え、`WORLDS` の
  meadow.levelIds 内の該当 id も更新）
- Test（作業用、最後に空に戻す）: `__tests__/tools/level-simulate.test.ts`,
  `__tests__/tools/level-draft.test.ts`

**Interfaces:**
- Consumes: `snake()`/`cells()`/`targets()` ヘルパー（`levels.ts` 冒頭で定義済み）
- Produces: 新 id（例: `wall-companion-5x6`）を `LEVELS` と `WORLDS.meadow.levelIds` の
  両方に反映

- [ ] **Step 1: 逆算した初期案を `level-simulate.test.ts` に書く**

```ts
const SCENARIOS: Scenario[] = [
  {
    label: 'wall-companion: A(縦)は壁で止まり、B(横)はAにぶつかって止まる',
    level: {
      id: 'sim-wall-companion',
      name: 'sim',
      rows: 5,
      cols: 6,
      walls: cells([[4, 1]]),
      targets: [],
      snakes: [
        snake('a', [[2, 1], [1, 1], [0, 1]]),
        snake('b', [[3, 4], [3, 5]]),
      ],
    },
    moves: [
      { snakeId: 'a', dir: 'down' },
      { snakeId: 'b', dir: 'left' },
    ],
  },
];
```

期待する最終形（手計算での見立て）: `a` は `(1,1),(2,1),(3,1)` に止まる（頭が (2,1) で
下端にあるので下に動ける。壁 (4,1) の手前で止まる）。`b` は `a` が先に (3,1) へ来ていれば
`(3,2),(3,3)` で止まる（先に `b` を動かすと (3,1)〜(3,3) は素通りできてしまい盤端の
`(3,0),(3,1)` まで行ってしまうので、正しい順番でないと違う形になる）。

- [ ] **Step 2: `npm run levels:simulate` を実行し、実際の終形を確認する**

Run: `npm run levels:simulate`
出力の `最終:` 行を見て、`a` と `b` の最終セルを記録する。Step 1 の見立てとズレていたら、
`walls`/初期位置を調整して再実行する（壁の位置がズレていたら `a` が止まる行がズレるので、
`walls` の座標を 1 マスずつ動かして再確認する）。

- [ ] **Step 3: 確認できた終形を `level-draft.test.ts` の `DRAFTS` に転記し、監査を通す**

`targets` は Step 2 で確認した `a`・`b` の最終セルをそのまま列挙する
（`a` の 3 マス + `b` の 2 マス = 5 マス。ヘビの長さ合計も 5 のはず）。

Run: `npm run levels:draft`
Expected: `OK [meadow] <新id>  2手  中身2  空手率0.00  最短解1通り  ★?` かつ issues 行なし、
`重複:` 行なし。もし「退化解」で落ちたら、`a`・`b` の移動方向が異なる（down / left）ので
本来は落ちないはず — 落ちた場合は `audit.ts` の該当メッセージを読み、必要なら
`level.audit.reason` で明示的に例外化する。

- [ ] **Step 4: `levels.ts` の `plus-shape-6x5` エントリを新設計で置き換える**

id は内容に合わせて新しくする（例: `wall-companion-5x6`）。`name`・`hint` も新内容に合わせる。
`parMoves`・`difficulty` は Step 3 の `npm run levels:draft` 出力の値をそのまま使う。

- [ ] **Step 5: `WORLDS` の meadow.levelIds 内、旧 id を新 id に置き換える**

`grep -n "plus-shape-6x5" src/levels/levels.ts` で `LEVELS` 定義側と `WORLDS` 側の
両方がヒットすることを確認し、両方を新 id に揃える。

- [ ] **Step 6: 作業用ツールファイルを空配列に戻す**

`level-simulate.test.ts` の `SCENARIOS` と `level-draft.test.ts` の `DRAFTS` を
`[]` に戻す（テンプレ状態）。

---

### Task 2: zigzag-wall-6x6 → C+A「折れ形の最後の一手を壁で止める（3 回曲がる）」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

**Interfaces:** Task 1 と同じヘルパーを使う。

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'zigzag3: 3回曲がって壁で止まる大きめの折れ形',
  level: {
    id: 'sim-zigzag3',
    name: 'sim',
    rows: 6,
    cols: 6,
    walls: cells([[5, 4], [4, 0], [1, 1]]),
    targets: [],
    snakes: [snake('a', [[0, 4], [0, 3], [0, 2], [0, 1], [0, 0]])],
  },
  moves: [
    { snakeId: 'a', dir: 'down' },
    { snakeId: 'a', dir: 'left' },
    { snakeId: 'a', dir: 'up' },
  ],
}
```

見立て: 1手目(down)で壁(5,4)の手前 row4 まで滑って縦棒になる。2手目(left)で壁(4,0)の
手前 col1 まで滑って角が1つ増える。3手目(up)で壁(1,1)の手前 row2 まで滑ってもう1つ角が
増える。既存の zigzag-wall-5x5（2 回曲がり・壁 1 枚）より折れが多く壁も多い、明確に
違う面にする。

- [ ] **Step 2: `npm run levels:simulate` で終形を確認し、ズレていたら壁座標を調整して再実行**

- [ ] **Step 3: 終形を `level-draft.test.ts` に転記し `npm run levels:draft` で OK を確認**

Expected: 中身のある手（空手率 0.00）、issues なし。既存の `zigzag-wall-5x5` と
`findSimilarLevels` で重複判定されないこと（`重複:` 行が出ないこと）を確認する。
似すぎと判定されたら、曲がる順番（down→left→up ではなく down→right→down 等）を変えて
やり直す。

- [ ] **Step 4-6:** Task 1 の Step 4-6 と同じ手順で `levels.ts`（旧 `zigzag-wall-6x6` を
  新 id・新内容に）と `WORLDS` を更新し、ツールファイルを空に戻す。

---

### Task 3: triple-still-4x5 → B「2匹とも実際に動く。順番を間違えると通り道がふさがる」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'order-basic: Aが先に下・右へ動かないと、Bの止まる場所が変わる',
  level: {
    id: 'sim-order-basic',
    name: 'sim',
    rows: 4,
    cols: 6,
    walls: cells([[3, 2]]),
    targets: [],
    snakes: [
      snake('a', [[0, 0], [0, 1]]),
      snake('b', [[0, 4], [0, 5]]),
    ],
  },
  moves: [
    { snakeId: 'a', dir: 'down' },
    { snakeId: 'a', dir: 'right' },
    { snakeId: 'b', dir: 'left' },
  ],
}
```

見立て（wide-6x7 と同じ技法を縮小したもの）: `a` は下に滑って縦棒になり、右に滑って
壁(3,2)の手前 col1 で止まり `(3,0),(3,1)` になる。`b` は `a` がまだ row0 にいる間に
左へ滑ると `a` の胴体 (0,1) にぶつかって `(0,2),(0,3)` で止まる。`a` が先に row0 を
空けてしまうと `b` は盤端 col0 まで行ってしまい、別の形になる。

- [ ] **Step 2: `npm run levels:simulate` で終形確認、必要なら座標調整**

- [ ] **Step 3: `level-draft.test.ts` に転記して `npm run levels:draft` で OK を確認**

特に確認すること: `findSimilarLevels` で **wide-6x7 と重複判定されないか**。もし
似すぎと出たら、`b` も曲がる手（例: left の後に down）を 1 手加えて手数・ターン数の
指紋を変える。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新し、ツールファイルを空に戻す
  （新 id 例: `order-intro-4x6`）。

---

### Task 4: square-shape-5x4 → D「頭の位置で押す向きが変わる（縦向き導入）」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'orientation-vertical: 縦向きの頭の位置で押す方向が変わる',
  level: {
    id: 'sim-orientation-vertical',
    name: 'sim',
    rows: 5,
    cols: 3,
    walls: [],
    targets: [],
    snakes: [
      snake('a', [[2, 0], [1, 0]]),
      snake('b', [[1, 2], [2, 2]]),
    ],
  },
  moves: [
    { snakeId: 'a', dir: 'down' },
    { snakeId: 'b', dir: 'up' },
  ],
}
```

見立て: `a` は頭が下端 (2,0) なので下へ滑って盤端 (4,0) まで行き `(3,0),(4,0)` になる。
`b` は頭が上端 (1,2) なので上へ滑って盤端 (0,2) まで行き `(0,2),(1,2)` になる。
既存の `orientation-big-3x7`（横向き）と違い縦向きのミラー配置にすることで、指紋を変える。

- [ ] **Step 2〜3:** Task 1 と同様に `npm run levels:simulate` → `npm run levels:draft` を
  実行し、OK（重複 0 組含む）を確認する。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新し、ツールファイルを空に戻す
  （新 id 例: `orientation-vertical-5x3`）。

---

### Task 5: 章 1 バッチのフル検証

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: フルテスト**

Run: `npx jest --ci`
Expected: 全 PASS（`全ステージの検証` に Task 1-4 の新 id が含まれ、いずれも
「定義が健全」「解ける」「parMoves一致」「品質監査に指摘なし」を通ること）

- [ ] **Step 3: 監査レポート**

Run: `npm run levels:audit`
Expected: 30 行すべて `OK`、`似ている面: 0 組`

---

## 章 2 バッチ（4 面差し替え）

### Task 6: trio-7x7 → B+A「3匹の分担に、壁での精密停止を追加」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 既存 trio-7x7 の構造（3匹が3方向から中央付近へ集まる／順番を誤ると
  通り道がふさがる）を踏襲しつつ、いずれか1匹の停止を盤端ではなく壁にする初期案を
  `level-simulate.test.ts` に書く**

```ts
{
  label: 'trio-precise: 3匹が集まる。1匹は壁でちょうど止まらないと次の手が詰む',
  level: {
    id: 'sim-trio-precise',
    name: 'sim',
    rows: 6,
    cols: 6,
    walls: cells([[5, 2], [2, 5]]),
    targets: [],
    snakes: [
      snake('a', [[0, 0], [0, 1], [0, 2]]),
      snake('b', [[5, 5], [5, 4], [5, 3]]),
      snake('c', [[2, 0], [2, 1]]),
    ],
  },
  moves: [
    { snakeId: 'c', dir: 'right' },
    { snakeId: 'a', dir: 'down' },
    { snakeId: 'b', dir: 'up' },
  ],
}
```

`c` を先に右へ動かして通り道を空けてから `a`（下へ、壁(5,2)手前で止める）・
`b`（上へ、壁(2,5)手前で止める）を動かす、という3手構成の見立て。`npm run levels:simulate`
の実際の出力に合わせて壁位置・手順を調整する（`c` の位置が `a` や `b` の経路と重ならない
よう座標を詰める）。

- [ ] **Step 2〜3:** `npm run levels:simulate` → `npm run levels:draft` で OK を確認
  （既存の trio-7x7 が消えるので、新 id で `findSimilarLevels` の重複 0 組を確認）。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `trio-precise-6x6`）、
  ツールファイルを空に戻す。

---

### Task 7: block-4x4 → E+G「仲間がワープの出口をふさぐ／空ける」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'warp-block: 仲間がワープ出口に居座っている間は通れない',
  level: {
    id: 'sim-warp-block',
    name: 'sim',
    rows: 5,
    cols: 5,
    walls: [],
    warps: [warp([1, 0], [3, 4])],
    targets: [],
    snakes: [
      snake('a', [[1, 2], [1, 1]]),
      snake('b', [[4, 4], [4, 3]]),
    ],
  },
  moves: [
    { snakeId: 'b', dir: 'up' },
    { snakeId: 'a', dir: 'left' },
  ],
}
```

見立て: `b` を先に上へ動かして warp 出口 (3,4) 付近から退避させて経路を作る
（あるいは逆に `b` が居座ることで `a` のワープ後の進路をふさぐ設計でもよい —
`npm run levels:simulate` の実際の挙動を見て、E（仲間が壁）と G（ワープの向き保持）が
両方効く形に座標を追い込む）。`warp()` ヘルパーは `level-simulate.test.ts` の
`_helpers` に無いため、`level-draft.test.ts` 側の `warp`/`gate`/`toggle` 定義パターンを
参考に `level-simulate.test.ts` 冒頭へ同様のヘルパーを追加する。

- [ ] **Step 2〜3:** simulate → draft で OK を確認。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `warp-block-5x5`）、
  ツールファイルを空に戻す。

---

### Task 8: trio-chain-4x5 → C+E「折れ形の途中を仲間に止められる」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'bend-companion: 仲間にぶつかって曲がる（壁の代わりに仲間で1回曲げる）',
  level: {
    id: 'sim-bend-companion',
    name: 'sim',
    rows: 5,
    cols: 5,
    walls: cells([[4, 3]]),
    targets: [],
    snakes: [
      snake('a', [[0, 3], [0, 2], [0, 1]]),
      snake('b', [[3, 0]]),
    ],
  },
  moves: [{ snakeId: 'a', dir: 'down' }, { snakeId: 'a', dir: 'left' }],
}
```

見立て: `a` が下へ滑って壁(4,3)の手前 row3 で止まって縦棒になり、続けて左へ滑ると
`b`（あらかじめ (3,0) で待っている仲間）にぶつかって col1 で止まる（Task 1 の A+E と
似た構図だが、こちらは折れ形（C）を主眼にする点で差別化する）。`findSimilarLevels` で
Task 1・trio-chain の元設計と重複しないか draft ツールで必ず確認する。

- [ ] **Step 2〜3:** simulate → draft で OK（重複 0 組）を確認。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `bend-companion-5x5`）、
  ツールファイルを空に戻す。

---

### Task 9: companion-4x4 → D+E「頭の向きで、どの仲間が壁になるか変わる」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

Task 4 の縦向き D パターンをベースに、`a`・`b` それぞれの進路上に仲間ヘビ `c`・`d` を
静止配置し、「向きで押す方向が変わる」＋「その方向にいる仲間で止まる」を組み合わせる。

```ts
{
  label: 'orientation-companion: 向きで押す方向が変わり、その先の仲間で止まる',
  level: {
    id: 'sim-orientation-companion',
    name: 'sim',
    rows: 5,
    cols: 4,
    walls: [],
    targets: [],
    snakes: [
      snake('a', [[2, 0], [1, 0]]),
      snake('b', [[1, 3], [2, 3]]),
      snake('c', [[4, 0]]),
      snake('d', [[0, 3]]),
    ],
  },
  moves: [
    { snakeId: 'a', dir: 'down' },
    { snakeId: 'b', dir: 'up' },
  ],
}
```

見立て: `a` は下へ滑って仲間 `c`（(4,0) で待機）にぶつかり `(2,0),(3,0)` で止まる。
`b` は上へ滑って仲間 `d`（(0,3) で待機）にぶつかり `(1,3),(2,3)`（＝ほぼ動かない）に
なってしまう可能性があるので、`d` の位置を `(0,3)` からもう少し離す（例えば盤を広げて
`d` を1マス上に余裕を持たせる）よう `npm run levels:simulate` の結果を見て調整する。

- [ ] **Step 2〜3:** simulate → draft で OK（重複 0 組）を確認。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `orientation-companion-5x4`）、
  ツールファイルを空に戻す。

---

### Task 10: 章 2 バッチのフル検証

- [ ] **Step 1:** `npx tsc --noEmit`
- [ ] **Step 2:** `npx jest --ci`（全 PASS）
- [ ] **Step 3:** `npm run levels:audit`（30 行 `OK`、重複 0 組）

---

## 章 3 バッチ（3 面差し替え、卒業面含む）

### Task 11: pair-5x5 → F+D「頭の向きで、通れるゲートが変わる」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

既存 `gate-intro-5x5` の 1 スイッチ・1 ゲート構成をベースに、ゲートを 2 つ（別グループ）
にし、どちらのゲートへ向かうかを頭の位置で変える。`level-simulate.test.ts` に
`gate()`/`toggle()` ヘルパーが無ければ `level-draft.test.ts` と同じ定義を追加する。

```ts
{
  label: 'gate-orientation: スイッチで両ゲートが開くが、頭の向きで通れる側が変わる',
  level: {
    id: 'sim-gate-orientation',
    name: 'sim',
    rows: 5,
    cols: 5,
    walls: [],
    gates: [gate(2, 1, 'g'), gate(2, 3, 'g')],
    switches: [toggle(4, 2, 'g')],
    targets: [],
    snakes: [
      snake('s', [[4, 2]]),
      snake('a', [[2, 2], [2, 1]]),
    ],
  },
  moves: [{ snakeId: 'a', dir: 'left' }],
}
```

見立て: `s` がスイッチに乗ったまま（動かさない）でゲート 2 つが開く。`a` は頭の位置に
よって左のゲート方向にしか進めない（頭が (2,2) で右向きなら右のゲートへは進めない、
など）。`npm run levels:simulate` で実際の可否を確認し、頭の向きが本当に結果を分けるよう
座標を調整する。

- [ ] **Step 2〜3:** simulate → draft で OK（重複 0 組）を確認。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `gate-orientation-5x5`）、
  ツールファイルを空に戻す。

---

### Task 12: weave-6x7 → F+G「ワープを抜けないとスイッチ側に届かない」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: 初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'gate-via-warp: ワープを抜けた側にしかスイッチが無い',
  level: {
    id: 'sim-gate-via-warp',
    name: 'sim',
    rows: 6,
    cols: 6,
    walls: [],
    warps: [warp([2, 0], [2, 5])],
    gates: [gate(0, 3, 'g')],
    switches: [toggle(2, 4, 'g')],
    targets: [],
    snakes: [snake('a', [[2, 1], [2, 2]])],
  },
  moves: [
    { snakeId: 'a', dir: 'left' },
    { snakeId: 'a', dir: 'right' },
  ],
}
```

見立て: `a` は左へ滑ってワープ (2,0)→(2,5) を抜け、そのまま向き(右？進入方向で決まる)を
保って進み続け、スイッチ (2,4) の近くに出る。`npm run levels:simulate` で実際の経路と
停止セルを確認し、スイッチに乗れる・ゲートを抜けられる位置関係になるよう
壁/ワープ座標を調整する。

- [ ] **Step 2〜3:** simulate → draft で OK（重複 0 組）を確認。

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `gate-via-warp-6x6`）、
  ツールファイルを空に戻す。

---

### Task 13: orientation-3x5 → F+E+B「卒業面。スイッチ・仲間・手順の3点セット」

**Files:** Task 1 と同じ 2 ファイル + `levels.ts`

- [ ] **Step 1: gate-move-in-7x7（今回のセッションで作成済みの F+E 実例）を土台に、
  3つ目の要素として「頭の向きで通るゲートが変わる」(D成分、実質 F+E+D) もしくは
  「もう1匹の順番」(B成分) のどちらかを足す初期案を `level-simulate.test.ts` に書く**

```ts
{
  label: 'graduation: 体2マスの仲間でスイッチを押し、正しい順で離れてからゲートを抜ける',
  level: {
    id: 'sim-graduation',
    name: 'sim',
    rows: 7,
    cols: 7,
    walls: cells([[4, 3]]),
    gates: [gate(2, 2, 'g'), gate(2, 4, 'h')],
    switches: [toggle(4, 2, 'g'), toggle(4, 4, 'h')],
    targets: [],
    snakes: [
      snake('m', [[2, 6], [2, 5]]),
      snake('b', [[4, 0], [4, 1]]),
      snake('c', [[4, 6], [4, 5]]),
    ],
  },
  moves: [
    { snakeId: 'b', dir: 'right' },
    { snakeId: 'c', dir: 'left' },
    { snakeId: 'm', dir: 'left' },
    { snakeId: 'b', dir: 'down' },
    { snakeId: 'c', dir: 'down' },
  ],
}
```

`gate-move-in-7x7` と同じ骨格（体2マスの仲間 `b`/`c` がスイッチを押し、`m` が両ゲートを
一気に抜けてから `b`/`c` が自分のゲートを踏まずに離れる）に、**盤を広げて `m` の入口側に
頭の向きで通れるゲートが変わる分岐（D）を追加**し、F+E に加えて頭の位置判断も要求する
卒業面にする。`npm run levels:simulate` の実際の結果を見ながら、D の分岐が本当に
機能する（間違った頭の向きだとどちらかのゲートで止まる）まで座標を追い込む。
`gate-move-in-7x7` と `findSimilarLevels` で重複判定されないよう、盤サイズ・ゲート数・
手数のいずれかを明確に変える。

- [ ] **Step 2: `npm run levels:simulate` で終形を確認しながら D 成分を追い込む**

- [ ] **Step 3: `level-draft.test.ts` に転記し `npm run levels:draft` で OK
  （重複 0 組、issues 空）を確認する。想定 ★ が章の最終面としてふさわしい高さ
  （★4〜5）になっているかも確認する。**

- [ ] **Step 4-6:** `levels.ts`／`WORLDS` を更新（新 id 例: `graduation-7x7`）、
  ツールファイルを空に戻す。この面が章 3・ゲーム全体の最終面になるよう
  `WORLDS.night.levelIds` の並びも調整する（実測 ★ を見てから最終決定）。

---

### Task 14: 章 3 バッチのフル検証 + 全体の並び順調整

- [ ] **Step 1:** `npx tsc --noEmit`
- [ ] **Step 2:** `npx jest --ci`（全 PASS）
- [ ] **Step 3:** `npm run levels:audit`（30 行 `OK`、重複 0 組）
- [ ] **Step 4:** `npm run levels:report` で 30 面の ★ を確認し、各章内の並びが
  ★ の低い順になっているか確認する。ズレていたら（今回のハート面と同じ要領で）
  `WORLDS` 内の該当 id の並び順と `LEVELS` 配列内の物理的な並び順（表示番号のもと）を
  一致させて調整する。
- [ ] **Step 5:** `docs/level-design.md` に「組み合わせ設計」の項と
  「同時に動かせる駒は 4〜5 匹まで」の実装上の注意を追記する。

---

## 完了条件

- `LEVELS` は依然として 30 面、`WORLDS` は 3 章のまま。
- 差し替えた 11 面はすべて `npm run levels:draft` で `OK`（issues 空、重複 0 組）だった
  設計のみが `levels.ts` に入っている。
- `npx tsc --noEmit`・`npx jest --ci`・`npm run levels:audit` がすべて通る。
- 章内の表示番号（`displayName`）が 1〜30 の連番で、章をまたいでも整合している。
