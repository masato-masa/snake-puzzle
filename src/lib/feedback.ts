import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { playSfx } from './sound';

/** Web では触覚フィードバックが無いので黙って何もしない（音は Web だけ鳴る。sound.ts）。 */
const enabled = Platform.OS !== 'web';

const run = (fn: () => Promise<void>) => {
  if (!enabled) return;
  fn().catch(() => {
    // 端末が対応していなくてもプレイに影響させない
  });
};

/** ヘビが動いたとき。 */
export const feedbackMove = () => {
  playSfx('move');
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
};

/** 動けない向きに払ったとき。 */
export const feedbackBlocked = () => {
  playSfx('blocked');
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
};

/** クリアしたとき。 */
export const feedbackClear = () => {
  playSfx('clear');
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
};

/** ヘビを選んだ・ヒントを出したとき。 */
export const feedbackSelect = () => {
  playSfx('select');
  run(() => Haptics.selectionAsync());
};
