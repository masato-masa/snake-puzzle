import { endlessSteps, type EndlessLevel } from '@/levels/endless';

/**
 * むげんモードの面を、画面を止めずに作る（ネイティブと、Worker を作れなかった Web 用）。
 *
 * 生成は小分け（1 区切り = 生成 1 回か解析 1 回）に進め、合間に描画へ譲る。
 * 先読み（priority: 'idle'）は、指で触ってから少し経つまで進めない。
 * 1 区切りが長いと、遊んでいる最中の操作が引っかかるため。
 */

export type Priority = 'now' | 'idle';

const IDLE_AFTER_MS = 1200;
const SLICE_MS = 12;

let lastInput = 0;

/** 画面が触られたら呼ぶ。先読みを少し待たせる。 */
export const markInput = () => {
  lastInput = Date.now();
};

type Job = { promise: Promise<EndlessLevel>; priority: { value: Priority } };
const jobs = new Map<number, Job>();

export const requestEndless = (n: number, priority: Priority = 'now'): Promise<EndlessLevel> => {
  const hit = jobs.get(n);
  if (hit) {
    if (priority === 'now') hit.priority.value = 'now';
    return hit.promise;
  }
  const state = { value: priority };
  const promise = new Promise<EndlessLevel>((resolve) => {
    const it = endlessSteps(n);
    const tick = () => {
      if (state.value === 'idle' && Date.now() - lastInput < IDLE_AFTER_MS) {
        setTimeout(tick, 200);
        return;
      }
      const start = Date.now();
      for (;;) {
        const step = it.next();
        if (step.done) {
          resolve(step.value);
          return;
        }
        if (Date.now() - start > SLICE_MS) break;
      }
      setTimeout(tick, state.value === 'idle' ? 30 : 0);
    };
    setTimeout(tick, 0);
  });
  jobs.set(n, { promise, priority: state });
  for (const key of jobs.keys()) if (Math.abs(key - n) > 2) jobs.delete(key);
  return promise;
};
