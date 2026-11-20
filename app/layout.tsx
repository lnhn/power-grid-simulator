import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: '化工厂电网模拟系统',
  description: '小型电网模拟与操作平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 首屏前同步应用已保存的皮肤，避免 localStorage 在 useEffect 中读取导致主题闪烁
  const themeScript = `
    (function () {
      try {
        var skin = localStorage.getItem('pg.skin') || 'industrial';
        var mode = localStorage.getItem('pg.mode') || 'light';
        if (['industrial', 'schematic', 'paper'].indexOf(skin) === -1) skin = 'industrial';
        if (['light', 'dark'].indexOf(mode) === -1) mode = 'light';
        document.documentElement.setAttribute('data-skin', skin);
        document.documentElement.setAttribute('data-mode', mode);
      } catch (e) {}
    })();
  `

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
