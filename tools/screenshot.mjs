// 開発サーバー（npm run web）の画面を撮る。
//
//   node tools/screenshot.mjs                          … 既定の一式
//   node tools/screenshot.mjs /game/pair-5x5           … ルート指定
//   node tools/screenshot.mjs / --size=390x844         … サイズ指定
//
// 端末にある Chrome / Edge をそのまま使うので、ブラウザの追加ダウンロードは不要。
// 出力先は screenshots/ 。

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const executablePath = BROWSERS.find((path) => path && existsSync(path));
if (!executablePath) {
  console.error('Chrome / Edge が見つかりませんでした。');
  process.exit(1);
}

const args = process.argv.slice(2);
const sizeArg = args.find((a) => a.startsWith('--size='))?.slice(7);
const routes = args.filter((a) => !a.startsWith('--'));
const baseUrl = process.env.SHOT_BASE_URL ?? 'http://localhost:8081';
const outDir = resolve('screenshots');
mkdirSync(outDir, { recursive: true });

/** 既定は iPhone 相当の縦画面。 */
const DEFAULT_SIZE = '390x844';

const TARGETS = routes.length
  ? routes.map((route) => ({ route, size: sizeArg ?? DEFAULT_SIZE }))
  : [
      { route: '/', size: DEFAULT_SIZE },
      { route: '/game/warmup-3x3', size: DEFAULT_SIZE },
      { route: '/game/trio-7x7', size: DEFAULT_SIZE },
      { route: '/game/gate-intro-5x5', size: DEFAULT_SIZE },
      { route: '/', size: '1280x800' },
    ];

const nameOf = (route, size) => {
  const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
  return `${slug}_${size}.png`;
};

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--hide-scrollbars', '--disable-gpu'],
});

try {
  for (const { route, size } of TARGETS) {
    const [width, height] = size.split('x').map(Number);
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: width < 768 });
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle2', timeout: 60_000 });
    // 画面の組み立てとアニメーションが落ち着くのを待つ
    await new Promise((r) => setTimeout(r, 1200));

    const metrics = await page.evaluate(() => ({
      inner: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));

    const file = join(outDir, nameOf(route, size));
    await page.screenshot({ path: file });
    await page.close();

    const overflow = metrics.scroll > metrics.inner ? `  ⚠ 横あふれ ${metrics.scroll}px` : '';
    console.log(`saved ${file}  (viewport ${metrics.inner}px)${overflow}`);
  }
} finally {
  await browser.close();
}
