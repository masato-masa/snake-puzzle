// 画面の要素の計算スタイルを覗くデバッグ用ツール。
//   node tools/inspect.mjs "/" "はじめの一歩"

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = BROWSERS.find((p) => existsSync(p));
const [route = '/', needle = ''] = process.argv.slice(2);
const baseUrl = process.env.SHOT_BASE_URL ?? 'http://localhost:8081';

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1000));

const result = await page.evaluate((text) => {
  const nodes = [...document.querySelectorAll('div')].filter((el) =>
    el.textContent?.includes(text),
  );
  const target = nodes[nodes.length - 1];
  if (!target) return { error: 'not found' };

  const chain = [];
  let el = target;
  for (let i = 0; i < 5 && el; i++) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName,
      bg: s.backgroundColor,
      border: `${s.borderTopWidth} ${s.borderTopColor}`,
      radius: s.borderRadius,
      rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      classes: el.className?.toString().slice(0, 60),
    });
    el = el.parentElement;
  }
  return { chain };
}, needle);

console.log(JSON.stringify(result, null, 2));
await browser.close();
