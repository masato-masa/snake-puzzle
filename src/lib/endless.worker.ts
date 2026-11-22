// むげんモードの面を、画面とは別のスレッドで作る（Web 用）。
import { generateEndless } from '@/levels/endless';

type Request = { n: number };

const ctx = self as unknown as {
  onmessage: ((e: { data: Request }) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = (e) => {
  const { n } = e.data;
  try {
    ctx.postMessage({ n, result: generateEndless(n) });
  } catch (error) {
    ctx.postMessage({ n, error: String(error) });
  }
};
