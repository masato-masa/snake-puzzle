/**
 * ポップな 2D テイストの配色。
 * 青空・木枠の盤面・シアンに光るパネル、という組み合わせで統一する。
 */
export const colors = {
  /** アプリ全体のフォールバック背景色（各章の背景は画像に差し替え済み）。 */
  skyBottom: '#D6F0FF',

  medalGoldLight: '#FFF3C4',
  medalGold: '#FFD65C',
  medalGoldDark: '#C4841A',
  medalSilverLight: '#FFFFFF',
  medalSilver: '#E3E7EC',
  medalSilverDark: '#8B96A3',
  medalBronzeLight: '#F0C08C',
  medalBronze: '#D79A5E',
  medalBronzeDark: '#8A5326',

  /** 「次に遊べるステージ」の宝石色。メダル（実績）とは別系統の色にして意味を分ける。 */
  gemTealLight: '#BAF7F0',
  gemTeal: '#33E0D1',
  gemTealDark: '#0E8C82',

  metalLight: '#C7CABF',
  metal: '#9AA08F',
  metalDark: '#5E6354',

  wood: '#B0762F',
  woodDark: '#6B4116',
  woodLight: '#D09A52',
  woodGrain: 'rgba(107, 65, 22, 0.25)',

  floor: '#F7E6C4',
  floorLine: 'rgba(107, 65, 22, 0.14)',

  /**
   * 埋めるべきマス（光るパネル）。
   * ヘビの配色（緑・水色・ピンク・オレンジ）のどれとも重ならない、
   * すみれ色（バイオレット）にしている。似た色のヘビだけが対応する、という
   * 誤解を生まないようにするため。
   */
  glow: '#A78BFA',
  glowSoft: 'rgba(167, 139, 250, 0.32)',
  glowEdge: '#6D28D9',
  glowCore: '#F5F3FF',

  panel: '#FFF8EA',
  panelBorder: '#C89A5B',

  text: '#4A2E14',
  textMuted: '#8A6B47',
  textOnDark: '#FFFFFF',

  accent: '#FFB020',
  accentDark: '#C97C00',
  success: '#3FA845',
  successDark: '#26702B',
  danger: '#E8382F',
  dangerDark: '#A8180F',

  /**
   * ステージ一覧の「むずかしさ」表示専用の色。
   * クリア画面の成績★（accent の金色）とは別物だと一目でわかるよう、あえて別系統の色にしている。
   */
  difficultyOn: '#6B5CA5',
  difficultyOff: 'rgba(107, 92, 165, 0.22)',
} as const;

/** ギミックの配色。 */
export const mechanics = {
  sand: '#EAD3A0',
  sandEdge: '#C8A461',
  sandDot: 'rgba(122, 74, 33, 0.3)',
  /**
   * ゲートとスイッチは group ごとに色を変える。
   * ヘビの配色（緑・水色・ピンク・オレンジ）と紛らわしくならないよう、
   * 色相をなるべく離すか、同系統でも「くすんで暗い」トーンにして
   * 明るく鮮やかなヘビとは別カテゴリだと一目で分かるようにしている
   * （例: ヘビのピンクは鮮やかな桃色、ゲートのワインレッドは暗い臙脂色）。
   * 「同じ色のヘビでないと踏めないスイッチ」に見えてしまう誤解を防ぐため。
   */
  gateGroups: [
    { main: '#14B8A6', dark: '#0F766E' }, // 深緑がかったティール
    { main: '#1D4ED8', dark: '#1E3A8A' }, // 濃い藍色
    { main: '#9D174D', dark: '#831843' }, // 暗いワインレッド
  ],
  /** ワープ穴はペアごとに色を変える。ゲートと同じ理由で、ヘビとは離した色にする。 */
  warpPairs: [
    { main: '#C026D3', dark: '#701A75' }, // マゼンタ
    { main: '#92400E', dark: '#451A03' }, // 暗い赤茶
    { main: '#475569', dark: '#1E293B' }, // くすんだ鋼色
  ],
} as const;

/** group 名から安定した色を選ぶ。 */
export const colorForGroup = (
  group: string,
  palette: readonly { main: string; dark: string }[],
) => {
  let hash = 0;
  for (let i = 0; i < group.length; i++) hash = (hash * 31 + group.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
};

export type SnakeSkin = { body: string; dark: string; light: string };

/** ヘビの配色。body を Level の color に入れ、描画側で dark/light を引く。 */
export const snakeSkins = {
  green: { body: '#5DC94F', dark: '#2C7F31', light: '#95EE87' },
  sky: { body: '#4FB8E8', dark: '#256F98', light: '#9BDFF8' },
  pink: { body: '#F06CA8', dark: '#A32E63', light: '#FBB1D0' },
  amber: { body: '#F5A623', dark: '#A96605', light: '#FBD08A' },
} as const satisfies Record<string, SnakeSkin>;

export const snakeColors = {
  green: snakeSkins.green.body,
  sky: snakeSkins.sky.body,
  pink: snakeSkins.pink.body,
  amber: snakeSkins.amber.body,
} as const;

const skinList: SnakeSkin[] = Object.values(snakeSkins);

export const skinFor = (bodyColor: string): SnakeSkin =>
  skinList.find((skin) => skin.body === bodyColor) ?? snakeSkins.green;

/** ポップな見た目の共通値。 */
export const ui = {
  radius: 18,
  outline: 3,
  shadow: {
    shadowColor: 'rgba(74, 46, 20, 0.45)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
} as const;
