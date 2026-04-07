import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '팀 업무 보고 시스템',
  description: '일일보고 및 주간보고 관리',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
