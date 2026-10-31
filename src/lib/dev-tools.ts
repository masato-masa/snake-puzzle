import { Platform } from 'react-native';

/**
 * 「テスト用」（全ステージ開放・マイステージ）を出すか。
 * ストアに出すアプリ（ネイティブの本番ビルド）では出さない（SP-1）。
 * Web 版（GitHub Pages）と開発中は、他のパズルゲームと同じく右下に置いて確認に使う。
 */
export const SHOW_DEV_TOOLS: boolean = __DEV__ || Platform.OS === 'web';
