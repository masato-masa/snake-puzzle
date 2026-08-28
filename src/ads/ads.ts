/**
 * 広告レイヤー（ダミー実装）。
 *
 * 将来 AppStore/Google Play 配信時に実際の広告SDK（AdMob 等）へ差し替える前提の
 * プレースホルダ。UI 側（AdInterstitial・呼び出し元）はこのモジュールの
 * 関数だけを見ており、中身が本物の SDK 呼び出しに変わっても呼び出し側は変えずに済む。
 */

/** インタースティシャルを何ステージクリアごとに挟むか。 */
const INTERSTITIAL_EVERY_LEVELS = 3;

let clearsSinceLastAd = 0;

/**
 * ステージクリア→次のステージへ進むタイミングで、インタースティシャル広告を
 * 挟むべきかを返す。呼ぶたびにカウンタが進み、内部状態が更新される。
 */
export const shouldShowInterstitial = (): boolean => {
  clearsSinceLastAd += 1;
  if (clearsSinceLastAd < INTERSTITIAL_EVERY_LEVELS) return false;
  clearsSinceLastAd = 0;
  return true;
};

/** テスト・デバッグ用にカウンタをリセットする。 */
export const resetInterstitialCounter = (): void => {
  clearsSinceLastAd = 0;
};
