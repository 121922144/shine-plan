import type { Metadata, Viewport } from 'next'
import '../src/styles.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || 'http://localhost:5190'),
  title: '书包计划',
  description: '上传课程表，每晚自动提醒明天要带的书和用品。',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon-180x180.png' },
  appleWebApp: { capable: true, title: '书包计划', statusBarStyle: 'default' },
  openGraph: {
    title: '书包计划',
    description: '明天带什么，今晚就知道。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '书包计划' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '书包计划',
    description: '明天带什么，今晚就知道。',
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
  return <html lang="zh-CN"><body>{children}</body></html>
}
