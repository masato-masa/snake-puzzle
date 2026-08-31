import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { StageHub } from '@/components/stage-hub';
import { StagePath } from '@/components/stage-path';
import { todayKey } from '@/levels/daily';
import { LEVELS } from '@/levels/levels';
import { currentStreak, loadDaily, type DailyState } from '@/storage/daily';
import { loadProgress, type Progress } from '@/storage/progress';

export default function StageSelectScreen() {
  const router = useRouter();
  const window = useWindowDimensions();
  /**
   * 静的書き出し（SSG）したページは、初回描画時点では実際のウィンドウサイズを
   * 知らない。useWindowDimensions がハイドレーション後に正しい値へ更新される保証がなく、
   * 0×0 のまま固まって画面が真っ白になることがあったため、実測レイアウト（onLayout）を
   * 正として使い、useWindowDimensions は初期値の見積もりにとどめる。
   */
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const { width, height } = size;
  const [showStageList, setShowStageList] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [daily, setDaily] = useState<DailyState | null>(null);
  /** ホーム画面のタイル下で選ばれているステージ。未選択なら「次に遊ぶステージ」を使う。 */
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  /** 直前に読み込んだ progress。「選択中のステージを今まさにクリアしたか」の判定に使う。 */
  const progressRef = useRef<Progress>({});
  const today = todayKey();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadProgress().then((p) => {
        if (!active) return;
        const prevProgress = progressRef.current;
        progressRef.current = p;
        setProgress(p);
        // 選んでいたステージを「今まさに」クリア済みにしたときだけ、自動選択（次に遊ぶステージ）に戻す。
        // 元からクリア済みのステージを選んで見返している場合は、選択を保ったままにする。
        setSelectedLevelId((prev) => {
          if (!prev) return prev;
          const wasCleared = !!prevProgress[prev]?.cleared;
          const isClearedNow = !!p[prev]?.cleared;
          return !wasCleared && isClearedNow ? null : prev;
        });
      });
      loadDaily().then((d) => {
        if (active) setDaily(d);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const isCleared = (levelId: string) => !!progress[levelId]?.cleared;
  const clearedCount = LEVELS.filter((l) => isCleared(l.id)).length;
  const streak = daily ? currentStreak(daily, today) : 0;
  const continueLevel = LEVELS.find((l) => !isCleared(l.id)) ?? LEVELS[LEVELS.length - 1];
  const activeLevelId = selectedLevelId ?? continueLevel.id;

  const goToLevel = (levelId: string) =>
    router.push({ pathname: '/game/[levelId]', params: { levelId } });

  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setSize({ width: w, height: h });
  };

  return (
    <View style={styles.root} onLayout={onRootLayout}>
      {width === 0 || height === 0 ? null : (
        <View style={{ width, height }}>
          {showStageList ? (
            <StagePath
              progress={progress}
              clearedCount={clearedCount}
              initialLevelId={activeLevelId}
              onSelect={(levelId) => {
                setSelectedLevelId(levelId);
                setShowStageList(false);
              }}
              onClose={() => setShowStageList(false)}
            />
          ) : (
            <StageHub
              progress={progress}
              clearedCount={clearedCount}
              levelId={activeLevelId}
              streak={streak}
              onPlay={() => goToLevel(activeLevelId)}
              onOpenList={() => setShowStageList(true)}
              onOpenDaily={() => router.push('/daily')}
              onOpenMyStages={() => router.push('/my-stages')}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
