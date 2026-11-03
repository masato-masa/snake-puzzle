import {
  analyzeLevel,
  auditLevel,
  createGameState,
  isCleared,
  move,
  solve,
  validateLevel,
} from '@/engine';
import { LEVELS } from '@/levels/levels';

/** 分けるファイルの数。levels-0〜7.test.ts と揃える。 */
export const SHARDS = 8;

/**
 * 全ステージの面ごとの検証。1 ファイルで回すと 11 分かかり、そのほとんどが一部の面の
 * 品質監査だったので、面を SHARDS 個に振り分けて Jest に並列で回させる（SP-5）。
 * 重い面が並びで固まっているので、連続した区間ではなく番号を SHARDS で割った余りで分ける。
 */
export const checkLevelShard = (shard: number) => {
  const levels = LEVELS.filter((_, i) => i % SHARDS === shard);

  describe(`全ステージの検証（${shard + 1}/${SHARDS}）`, () => {
    it.each(levels.map((l) => [l.id, l] as const))('%s は定義が健全で解ける', (_id, level) => {
      expect(validateLevel(level)).toEqual([]);

      const result = solve(level, { maxMoves: 24, maxStates: 400_000 });
      expect(result.solved).toBe(true);
      expect(result.minMoves).toBe(level.parMoves);

      // 難易度は自動計算した値と一致させておく（ステージを触ったら必ず更新する）
      expect(analyzeLevel(level).stars).toBe(level.difficulty);

      // ソルバーの最短手順をそのまま再生するとクリアになる
      let state = createGameState(level);
      for (const m of result.moves ?? []) {
        const step = move(state, m.snakeId, m.dir);
        expect(step.moved).toBe(true);
        state = step.state;
      }
      expect(isCleared(state)).toBe(true);
      expect(state.moves).toBe(level.parMoves);
    });

    // 品質監査は警告ではなくエラー扱い。例外は level.audit に理由を書いて明示する。
    it.each(levels.map((l) => [l.id, l] as const))('%s の品質監査に指摘がない', (_id, level) => {
      expect(auditLevel(level).issues).toEqual([]);
    });
  });
};
