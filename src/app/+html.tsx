import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web の土台の HTML。ホーム画面に追加（PWA）のための manifest と meta をここに足す。
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <link rel="manifest" href="/snake-puzzle/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/snake-puzzle/apple-touch-icon.png" />
        <meta name="theme-color" content="#8ed03a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ヘビパズル" />
        <ScrollViewStyleReset />
        {/* アプリとして振る舞う。1 画面に収まっている画面を引っぱってもページごと動かない
            （iOS のバウンド、Android の引っぱって更新を止める）。 */}
        <style dangerouslySetInnerHTML={{ __html: 'html,body{overscroll-behavior:none}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
