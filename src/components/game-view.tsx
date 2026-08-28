import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { AdInterstitial } from '@/components/ad-interstitial';
import { Board } from '@/components/board';
import { Celebration } from '@/components/celebration';
import { ClearOverlay } from '@/components/clear-overlay';
import { HUD } from '@/components/hud';
import { SkyBackground } from '@/components/sky-background';
import { moveDurationFor } from '@/components/snake-view';
import {
  coveredTargetCount,
  createGameState,
  isCleared,
  move,
  reset,
  solve,
  undo,
  type Dir,
  type Level,
  type Move,
  type Pos,
} from '@/engine';
import type { WorldTheme } from '@/levels/levels';
import {
  feedbackBlocked,
  feedbackClear,
  feedbackMove,
  feedbackSelect,
} from '@/lib/feedback';
import { colors, ui } from '@/theme';

type Props = {
  level: Level;
  theme?: WorldTheme;
  /** クリア時に呼ぶ。自己ベスト手数を返すとクリア画面に出る。 */
  onCleared?: (moves: number) => Promise<number | undefined> | number | undefined | void;
  /** クリア画面の「つぎ」。省略するとボタンを出さない。 */
  onNext?: () => void;
  nextLabel?: string;
  onList: () => void;
  /** クリア画面に足す一言（デイリーの連続日数など）。 */
  clearNote?: string;
};

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * playing     … 操作できる
 * celebrating … ヘビが移動しきった後の演出中（操作は止める）
 * cleared     … クリア画面
 */
type Phase = 'playing' | 'celebrating' | 'cleared';

const CELEBRATION_MS = 1100;

/** 無料で使えるヒントの回数。これを超えたら広告を見ると使い放題になる。 */
const FREE_HINT_LIMIT = 3;

export function GameView({
  level,
  theme = 'meadow',
  onCleared,
  onNext,
  nextLabel,
  onList,
  clearNote,
}: Props) {
  /**
   * 盤面に使える領域は「画面サイズから引き算」ではなく実測する。
   * ヘッダーの高さやブラウザのUIぶんを取りこぼして、上下が見切れるのを防ぐため。
   */
  const [area, setArea] = useState({ width: 0, height: 0 });

  const [state, setState] = useState(() => createGameState(level));
  const [selectedId, setSelectedId] = useState(level.snakes[0].id);
  const [bestMoves, setBestMoves] = useState<number | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('playing');
  const [hint, setHint] = useState<Move | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [hintsUnlocked, setHintsUnlocked] = useState(false);
  const [showHintAd, setShowHintAd] = useState(false);
  const [bump, setBump] = useState<{ snakeId: string; token: number } | null>(null);
  const [trail, setTrail] = useState<{
    snakeId: string;
    path: Pos[];
    token: number;
    ms: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recorded = useRef(false);

  const cleared = isCleared(state);
  const stateRef = useRef(state);
  stateRef.current = state;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // 盤面の外枠は 1 マスの 0.28 倍ずつ内側に余白を取るので、その分を見込んで逆算する
  const fit = (space: number, count: number) => (space - 12) / (count + 0.6);
  const cell = Math.max(
    18,
    Math.min(
      72,
      Math.floor(
        Math.min(fit(Math.min(area.width, 560), level.cols), fit(area.height, level.rows)),
      ),
    ),
  );

  const onBoardAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  }, []);

  const handleDirection = useCallback((id: string, dir: Dir) => {
    if (phaseRef.current !== 'playing') return;

    const result = move(stateRef.current, id, dir);
    if (!result.moved) {
      // 動けない向き。ヘビをぷるんと縮めて知らせる
      setBump((prev) => ({ snakeId: id, token: (prev?.token ?? 0) + 1 }));
      feedbackBlocked();
      return;
    }

    setHint(null);
    setNotice(null);
    setTrail((prev) => ({
      snakeId: id,
      path: result.path,
      token: (prev?.token ?? 0) + 1,
      ms: moveDurationFor(result.path.length),
    }));
    setState(result.state);
    feedbackMove();
  }, []);

  /** 盤面をタップしたとき。選んでいるヘビの頭から見た向きへ動かす。 */
  const handleCellPress = useCallback(
    (pos: Pos) => {
      const snake = stateRef.current.snakes.find((s) => s.id === selectedIdRef.current);
      if (!snake) return;

      const head = snake.body[0];
      const dr = pos.r - head.r;
      const dc = pos.c - head.c;
      if (dr === 0 && dc === 0) return;

      const dir: Dir =
        Math.abs(dc) >= Math.abs(dr) ? (dc > 0 ? 'right' : 'left') : dr > 0 ? 'down' : 'up';
      handleDirection(snake.id, dir);
    },
    [handleDirection],
  );

  const handleUndo = useCallback(() => {
    setPhase('playing');
    setHint(null);
    setNotice(null);
    setTrail(null);
    setState((prev) => undo(prev));
  }, []);

  const handleReset = useCallback(() => {
    recorded.current = false;
    setBestMoves(undefined);
    setPhase('playing');
    setHint(null);
    setNotice(null);
    setTrail(null);
    setState((prev) => reset(prev));
  }, []);

  /** ソルバーに今の盤面を解かせて、正解の 1 手だけ見せる。無料回数を使い切ったら広告を挟む。 */
  const handleHint = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    if (hintCount >= FREE_HINT_LIMIT && !hintsUnlocked) {
      setShowHintAd(true);
      return;
    }

    const probe: Level = { ...level, snakes: stateRef.current.snakes };
    const result = solve(probe, { maxMoves: 20, maxStates: 200_000 });

    if (!result.solved || !result.moves?.length) {
      setHint(null);
      setNotice('この形からはもうクリアできない。1手もどしてみよう');
      feedbackBlocked();
      return;
    }

    setHint(result.moves[0]);
    setHintCount((n) => n + 1);
    setNotice(null);
    feedbackSelect();
  }, [level, hintCount, hintsUnlocked]);

  /** ヘビが動ききってから演出に入る。 */
  const handleSettled = useCallback(() => {
    if (isCleared(stateRef.current)) setPhase((p) => (p === 'playing' ? 'celebrating' : p));
  }, []);

  // アニメーションが何らかの理由で中断されても演出に入れるようにする保険
  useEffect(() => {
    if (!cleared || phase !== 'playing') return;
    const timer = setTimeout(() => setPhase('celebrating'), (trail?.ms ?? 200) + 160);
    return () => clearTimeout(timer);
  }, [cleared, phase, trail]);

  // 演出をひと通り見せてからクリア画面
  useEffect(() => {
    if (phase !== 'celebrating') return;
    feedbackClear();
    const timer = setTimeout(() => setPhase('cleared'), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' || recorded.current) return;
    recorded.current = true;
    Promise.resolve(onCleared?.(state.moves)).then((best) => {
      if (typeof best === 'number') setBestMoves(best);
    });
  }, [phase, onCleared, state.moves]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  // Web ではキーボードでも操作できるようにする（動作確認が楽になる）
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && level.snakes.length > 1) {
        event.preventDefault();
        setSelectedId((current) => {
          const index = level.snakes.findIndex((s) => s.id === current);
          return level.snakes[(index + 1) % level.snakes.length].id;
        });
        return;
      }
      const dir = KEY_TO_DIR[event.key];
      if (dir) {
        event.preventDefault();
        handleDirection(selectedId, dir);
        return;
      }
      if (event.key === 'z') handleUndo();
      if (event.key === 'r') handleReset();
      if (event.key === 'h') handleHint();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDirection, handleUndo, handleReset, handleHint, level.snakes, selectedId]);

  return (
    <SkyBackground theme={theme}>
      <View style={styles.screen}>
        <View style={styles.boardArea} onLayout={onBoardAreaLayout}>
          {area.width > 8 && area.height > 8 ? (
            <Board
              level={level}
              snakes={state.snakes}
              cell={cell}
              selectedId={selectedId}
              interactive={phase === 'playing'}
              onSelect={setSelectedId}
              onDirection={handleDirection}
              onSettled={handleSettled}
              hint={hint}
              bump={bump}
              trail={trail}
              onCellPress={phase === 'playing' ? handleCellPress : undefined}
            />
          ) : null}
          {phase === 'celebrating' ? <Celebration /> : null}
        </View>

        <View style={styles.footer}>
          {notice ?? level.hint ? (
            <View style={[styles.bubble, notice ? styles.bubbleAlert : null]}>
              <Text style={styles.bubbleText}>{notice ?? level.hint}</Text>
            </View>
          ) : null}

          <HUD
            moves={state.moves}
            parMoves={level.parMoves}
            canUndo={state.history.length > 0}
            onUndo={handleUndo}
            onReset={handleReset}
            onHint={handleHint}
            hintLabel={
              hintsUnlocked
                ? 'ヒント'
                : hintCount >= FREE_HINT_LIMIT
                  ? '広告でヒント'
                  : `ヒント (${FREE_HINT_LIMIT - hintCount})`
            }
          />
        </View>

        {showHintAd ? (
          <AdInterstitial
            title="ヒント使い放題"
            body={'広告を見ると、このステージの間\nヒントが使い放題になります。'}
            closeLabel="広告を見て解放"
            onClose={() => {
              setShowHintAd(false);
              setHintsUnlocked(true);
            }}
          />
        ) : null}

        {phase === 'cleared' ? (
          <ClearOverlay
            moves={state.moves}
            parMoves={level.parMoves}
            bestMoves={bestMoves}
            hintCount={hintCount}
            note={clearNote}
            hasNext={!!onNext}
            nextLabel={nextLabel}
            onNext={() => onNext?.()}
            onRetry={handleReset}
            onList={onList}
          />
        ) : null}
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  /** 余った高さは全部ここ。盤面はこの中に収まるサイズで描く。 */
  boardArea: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 操作系は必ず入りきる高さを確保する。 */
  footer: {
    flexShrink: 0,
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    paddingBottom: 12,
  },
  bubble: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: 420,
    ...ui.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleAlert: {
    borderColor: colors.accentDark,
    backgroundColor: '#FFF1CF',
  },
  bubbleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
