'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload } from '@/types'

interface MemberSummary {
  name: string
  position: string
  department: string
  lastDailyDate: string | null
  lastWeeklyStart: string | null
}

interface WeeklyDraftItem {
  weekStart: string
  weekEnd: string
  updatedAt: string
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart)
  const month = d.getMonth() + 1
  const weekOfMonth = Math.ceil((d.getDate() - 1) / 7) + 1
  return `${month}월 ${weekOfMonth}주차`
}

function formatMD(dateStr: string): string {
  return dateStr.slice(5).replace('-', '/')
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function dateBadge(dateStr: string | null, thresholds: [number, number] = [7, 14]) {
  if (!dateStr) return <span className="text-sm text-notion-gray font-medium">미작성</span>
  const days = daysAgo(dateStr)
  const color = days <= thresholds[0] ? 'text-green-600' : days <= thresholds[1] ? 'text-yellow-600' : 'text-red-500'
  return <span className={`text-sm font-medium ${color}`}>{dateStr}</span>
}

function MemberCard({ member }: { member: MemberSummary }) {
  const [expanded, setExpanded] = useState(false)
  const [weeklyList, setWeeklyList] = useState<WeeklyDraftItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!expanded && weeklyList === null) {
      setLoading(true)
      const res = await fetch(`/api/weekly/list?name=${encodeURIComponent(member.name)}`)
      const data = await res.json()
      setWeeklyList(Array.isArray(data) ? data : [])
      setLoading(false)
    }
    setExpanded(v => !v)
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-notion-text">{member.name}</span>
          {member.position && <span className="text-xs text-notion-gray">{member.position}</span>}
          {member.department && <span className="text-xs text-notion-gray">· {member.department}</span>}
        </div>
        <button
          onClick={toggle}
          className="shrink-0 text-xs text-notion-blue hover:underline"
        >
          {loading ? '로딩...' : expanded ? '접기 ▲' : '주간보고 목록 ▼'}
        </button>
      </div>

      <div className="flex flex-wrap gap-6 mt-3">
        <div>
          <p className="text-xs text-notion-gray mb-1">최근 일일보고</p>
          {dateBadge(member.lastDailyDate, [7, 14])}
        </div>
        <div>
          <p className="text-xs text-notion-gray mb-1">최근 주간보고</p>
          <div className="flex items-baseline gap-1.5">
            {dateBadge(member.lastWeeklyStart, [10, 20])}
            {member.lastWeeklyStart && (
              <span className="text-xs text-notion-gray">({weekLabel(member.lastWeeklyStart)})</span>
            )}
          </div>
        </div>
      </div>

      {expanded && weeklyList !== null && (
        <div className="mt-3 pt-3 border-t border-notion-border">
          <p className="text-xs text-notion-gray font-medium mb-2">주간보고 작성 내역</p>
          {weeklyList.length === 0 ? (
            <p className="text-xs text-notion-gray">작성된 주간보고가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {weeklyList.map(w => (
                <li key={w.weekStart} className="flex items-center justify-between text-xs">
                  <span className="text-notion-text">
                    <span className="font-medium">{weekLabel(w.weekStart)}</span>
                    <span className="text-notion-gray ml-1.5">({formatMD(w.weekStart)} ~ {formatMD(w.weekEnd)})</span>
                  </span>
                  <span className="text-notion-gray shrink-0 ml-4">
                    수정: {new Date(w.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportsClient({ session }: { session: JwtPayload }) {
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/summary')
      .then(r => r.json())
      .then(data => { setMembers(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-notion-text mb-1">보고 관리</h1>
        <p className="text-sm text-notion-gray mb-6">팀원별 최근 일일보고 · 주간보고 현황</p>

        {loading ? (
          <p className="text-sm text-notion-gray">불러오는 중...</p>
        ) : members.length === 0 ? (
          <div className="card">
            <p className="text-sm text-notion-gray">등록된 팀원이 없습니다. 환경설정 → 팀원 관리에서 팀원을 추가하세요.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-notion-gray mb-3">
              날짜 색상: <span className="text-green-600">● 최근</span>
              <span className="text-yellow-600 ml-2">● 2주 이상</span>
              <span className="text-red-500 ml-2">● 오래됨</span>
            </p>
            <div className="space-y-3">
              {members.map(m => <MemberCard key={m.name} member={m} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
