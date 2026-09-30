import type { Metadata, Viewport } from 'next'
import criticalStyles from '../src/styles.css?inline'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5190')),
  title: '闪闪计划',
  description: '快速查看今天和明天的课程，记录按日期准备的临时物品。',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/shine-icon-64x64.png', sizes: '64x64', type: 'image/png' }],
    shortcut: '/shine-icon-64x64.png',
    apple: [{ url: '/shine-apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: '闪闪计划', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: '闪闪计划',
    description: '打开就知道，今天明天上什么课。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '闪闪计划' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '闪闪计划',
    description: '打开就知道，今天明天上什么课。',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#f2faff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head><style dangerouslySetInnerHTML={{ __html: criticalStyles }} /></head>
      <body>{children}</body>
    </html>
  )
}
