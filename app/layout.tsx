import type { Metadata, Viewport } from 'next'
import criticalStyles from '../src/styles.css?inline'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || 'http://localhost:5190'),
  title: '书包计划',
  description: '快速查看今天和明天的课程，记录按日期准备的临时物品。',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon-180x180.png' },
  appleWebApp: { capable: true, title: '书包计划', statusBarStyle: 'default' },
  openGraph: {
    title: '书包计划',
    description: '打开就知道，今天明天上什么课。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '书包计划' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '书包计划',
    description: '打开就知道，今天明天上什么课。',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#f6f3ec',
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
