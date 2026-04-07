'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavbarProps {
  userName: string
  role: 'leader' | 'member' | 'admin'
}

export default function Navbar({ userName, role }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const links = role === 'admin'
    ? [
        { href: '/daily', label: '일일보고' },
        { href: '/weekly', label: '주간보고' },
        { href: '/reports', label: '보고 관리' },
        { href: '/settings', label: '환경설정' },
      ]
    : role === 'leader'
    ? [
        { href: '/reports', label: '보고 관리' },
        { href: '/settings', label: '환경설정' },
      ]
    : [
        { href: '/daily', label: '일일보고' },
        { href: '/weekly', label: '주간보고' },
        { href: '/settings', label: '환경설정' },
      ]

  return (
    <nav
      className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-notion-border"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-13 py-2.5">

          {/* 로고 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-notion-blue flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-notion-text text-sm hidden sm:block tracking-tight">업무 보고</span>
          </div>

          {/* 데스크탑 메뉴 */}
          <div className="hidden sm:flex items-center gap-0.5">
            {links.map(link => {
              const active = pathname.startsWith(link.href)
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-notion-blue text-white shadow-sm'
                      : 'text-notion-gray hover:text-notion-text hover:bg-notion-gray-bg'
                  }`}
                >
                  {link.label}
                </a>
              )
            })}
          </div>

          {/* 우측 유저 정보 + 로그아웃 */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-sm text-notion-text font-medium">{userName}</span>
              {role === 'leader' && (
                <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">팀장</span>
              )}
              {role === 'admin' && (
                <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full font-medium">관리자</span>
              )}
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="hidden sm:block text-xs text-notion-gray hover:text-notion-text border border-notion-border rounded-lg px-2.5 py-1.5 transition-all hover:bg-notion-gray-bg disabled:opacity-50"
            >
              {loggingOut ? '...' : '로그아웃'}
            </button>

            {/* 모바일 햄버거 버튼 */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="sm:hidden p-1.5 rounded-lg text-notion-gray hover:bg-notion-gray-bg transition-colors"
              aria-label="메뉴"
            >
              {menuOpen
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="sm:hidden border-t border-notion-border bg-white px-4 py-3 space-y-1">
          {/* 유저 정보 */}
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-notion-border">
            <span className="text-sm font-medium text-notion-text">{userName}</span>
            {role === 'leader' && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">팀장</span>}
            {role === 'admin' && <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full">관리자</span>}
          </div>
          {links.map(link => {
            const active = pathname.startsWith(link.href)
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-notion-blue text-white'
                    : 'text-notion-text hover:bg-notion-gray-bg'
                }`}
              >
                {link.label}
              </a>
            )
          })}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full mt-1 text-left px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            {loggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      )}
    </nav>
  )
}
