import type { ImageSourcePropType } from 'react-native';

import type { WorldTheme } from '@/levels/levels';

/** 章ごとのテーマオブジェクト（タイル）画像。ホーム画面の大タイルと、一覧のステージノードで共有する。 */
export const TILE_IMAGES: Record<WorldTheme, ImageSourcePropType> = {
  meadow: require('@/assets/images/tiles/meadow.png'),
  desert: require('@/assets/images/tiles/desert.png'),
  cave: require('@/assets/images/tiles/cave.png'),
  ice: require('@/assets/images/tiles/ice.png'),
  night: require('@/assets/images/tiles/night.png'),
};
