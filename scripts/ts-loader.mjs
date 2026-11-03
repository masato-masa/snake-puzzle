// node で src/ の TypeScript を直接読むためのフック（型の除去は node 自身が行う）。
// 拡張子なしの相対 import と `@/` を .ts / .tsx に解決する。
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith('@/')) spec = pathToFileURL(path.join(root, 'src', spec.slice(2))).href;
  const isPath = spec.startsWith('.') || spec.startsWith('file:');
  if (isPath && !/\.[cm]?[jt]sx?$/.test(spec)) {
    const base = spec.startsWith('file:')
      ? fileURLToPath(spec)
      : path.resolve(path.dirname(fileURLToPath(context.parentURL)), spec);
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
    }
  }
  return next(spec, context);
}
