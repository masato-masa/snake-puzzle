import type { EndlessLevel } from '@/levels/endless';

import * as main from './endless-runner-main';

/**
 * Web 版。生成は Worker で行うので、遊んでいる最中に先読みしても画面は止まらない。
 * Worker を作れない・落ちたときは、画面のスレッドで小分けに作る方式へ切り替える。
 */

export type Priority = main.Priority;
export const markInput = main.markInput;

type Reply = { n: number; result?: EndlessLevel; error?: string };

let worker: Worker | null | undefined;
const pending = new Map<number, { resolve: (v: EndlessLevel) => void; priority: Priority }[]>();
const done = new Map<number, Promise<EndlessLevel>>();

const getWorker = (): Worker | null => {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./endless.worker', import.meta.url));
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const { n, result } = e.data;
      const waiters = pending.get(n) ?? [];
      pending.delete(n);
      for (const w of waiters) {
        if (result) w.resolve(result);
        else main.requestEndless(n, w.priority).then(w.resolve);
      }
    };
    worker.onerror = () => {
      // 以後は画面のスレッドで作る。待っている分も作り直す。
      worker = null;
      for (const [n, waiters] of pending) {
        for (const w of waiters) main.requestEndless(n, w.priority).then(w.resolve);
      }
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
};

export const requestEndless = (n: number, priority: Priority = 'now'): Promise<EndlessLevel> => {
  const hit = done.get(n);
  if (hit) return hit;
  const w = getWorker();
  if (!w) return main.requestEndless(n, priority);
  const promise = new Promise<EndlessLevel>((resolve) => {
    pending.set(n, [{ resolve, priority }]);
    w.postMessage({ n });
  });
  done.set(n, promise);
  for (const key of done.keys()) if (Math.abs(key - n) > 2) done.delete(key);
  return promise;
};
