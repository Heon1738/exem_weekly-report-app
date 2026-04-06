import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '팀 업무 보고 시스템',
  description: '일일보고 및 주간보고 관리',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
