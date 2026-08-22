/**
 * ゲームロジックの型定義。
 * このディレクトリ（engine）は React / React Native に一切依存しない純 TypeScript。
 * UI・ソルバー・エディタ・テストはすべてここを共通の土台として使う。
 */

/** 盤面上の位置。r = 行（上が 0）、c = 列（左が 0）。 */
export type Pos = { r: number; c: number };

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'] as const;

export const DELTA: Record<Dir, Pos> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

/** body[0] が頭。以降は頭から尻尾に向かって連続したマス。 */
export type Snake = {
  id: string;
  color: string;
  body: Pos[];
  /** 色対応ルール（matchColor）用のグループ。coverAll では未使用。 */
  group?: string;
};

export type Target = {
  pos: Pos;
  /** 指定するとそのグループのヘビだけが覆える（matchColor 時のみ有効）。 */
  group?: string;
};

/**
 * coverAll  : 全ターゲットがいずれかのヘビで覆われればクリア（現行ルール）
 * matchColor: ターゲットは同じ group のヘビで覆う必要がある（将来の難易度拡張用）
 */
export type ClearRule = 'coverAll' | 'matchColor';

/** スイッチで開く壁。同じ group のスイッチが押されている間だけ通れる。 */
export type Gate = { pos: Pos; group: string };

/** ヘビが乗っている間、同じ group のゲートを開けるスイッチ。 */
export type Switch = { pos: Pos; group: string };

/** ワープ穴のペア。片方に入るともう片方から出て、同じ向きに進み続ける。 */
export type WarpPair = { a: Pos; b: Pos };

export type Level = {
  id: string;
  name: string;
  /** 盤面サイズは任意。3x3 でも 6x7 でもよい。 */
  rows: number;
  cols: number;
  /** 通れない障害物マス。 */
  walls: Pos[];
  /** 踏むとその 1 マスで止まる床。 */
  sands?: Pos[];
  gates?: Gate[];
  switches?: Switch[];
  warps?: WarpPair[];
  targets: Target[];
  /** 匹数・各長さともに自由。 */
  snakes: Snake[];
  clearRule?: ClearRule;
  /** ソルバーで求めた最少手数。 */
  parMoves?: number;
  /** analyzeLevel が出した難易度（★1〜5）。 */
  difficulty?: number;
  hint?: string;
  /**
   * 品質監査（auditLevel）の基準を意図的に外す場合の宣言。
   * 黙って許すと「意図した例外」と「ただの不備」が区別できなくなるので、必ず理由を書く。
   */
  audit?: {
    reason: string;
    allowEmptyMoveRatio?: number;
    allowRedundant?: string[];
    allowDegenerate?: boolean;
    allowIdle?: boolean;
  };
};

export type GameState = {
  level: Level;
  snakes: Snake[];
  moves: number;
  /** 1 手前の snakes を積んでいく（Undo 用）。 */
  history: Snake[][];
};

export type Move = { snakeId: string; dir: Dir };

export type MoveResult = {
  state: GameState;
  /** 1 マスも動けなかった場合は false（状態も手数も変化しない）。 */
  moved: boolean;
  /**
   * 頭が通ったマスの並び（動かなかった場合は空）。
   * 胴体が頭の軌跡をなぞるアニメーションに使う。
   */
  path: Pos[];
};

export const posKey = (p: Pos): string => `${p.r},${p.c}`;

export const posEq = (a: Pos, b: Pos): boolean => a.r === b.r && a.c === b.c;

export const addDir = (p: Pos, dir: Dir): Pos => ({
  r: p.r + DELTA[dir].r,
  c: p.c + DELTA[dir].c,
});

export const isAdjacent = (a: Pos, b: Pos): boolean =>
  Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
