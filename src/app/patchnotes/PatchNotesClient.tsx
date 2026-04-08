'use client'

import Navbar from '@/components/Navbar'
import type { JwtPayload } from '@/types'
import { PATCH_NOTES } from '@/lib/patchnotes'

interface Props { session: JwtPayload }

export default function PatchNotesClient({ session }: Props) {
  // 최신순 정렬
  const sorted = [...PATCH_NOTES].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-notion-text">패치노트</h1>
          <p className="text-sm text-notion-gray mt-1">업무 보고 시스템 업데이트 내역</p>
        </div>

        <div className="space-y-4">
          {sorted.map((entry, idx) => (
            <div key={entry.date} className="card">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-notion-blue">{entry.date}</span>
                {idx === 0 && (
                  <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">
                    최신
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-notion-text">
                    <span className="text-notion-blue shrink-0 font-medium">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-notion-gray text-center mt-8">
          페이지 개설일: 2026-04-04
        </p>
      </div>
    </div>
  )
}
