'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavbarProps {
  userName: string
  role: 'leader' | 'member'
}

export default function Navbar({ userName, role }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const links = [
    { href: '/daily', label: '일일보고' },
    { href: '/weekly', label: '주간보고' },
    ...(role === 'leader' ? [{ href: '/settings', label: '환경설정' }] : []),
  ]

  return (
    <nav className="bg-white border-b border-notion-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-notion-text text-sm">📋 업무 보고 시스템</span>
        <div className="flex gap-1">
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                pathname.startsWith(link.href)
                  ? 'bg-notion-gray-bg text-notion-text font-medium'
                  : 'text-notion-gray hover:bg-notion-gray-bg hover:text-notion-text'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-notion-gray">
          {userName}
          {role === 'leader' && <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">팀장</span>}
        </span>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-sm text-notion-gray hover:text-notion-text transition-colors"
        >
          로그아웃
        </button>
      </div>
    </nav>
  )
}
