'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload } from '@/types'

interface WeeklySummary {
  exists: boolean
  pageId?: string
  title?: string
  weekStart: string
  weekEnd: string
  authorName?: string
  createdDate?: string
  url?: string
}

interface DailyItem {
  id: string
  date: string
  emotion: string
  memorableEvent: string
  hardThing: string
  dailyFeeling: string
  workItems: Array<{
    category: string
    customerName?: string
    supportType?: string
    projectName?: string
    achievementType?: string
    content: string
  }>
}

interface Props {
  session: JwtPayload
}

function getWeekDates(baseDate: string) {
  const d = new Date(baseDate)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]
  return { weekStart: fmt(mon), weekEnd: fmt(fri) }
}

export default function WeeklyReportClient({ session }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedMember, setSelectedMember] = useState(session.name)
  const [members, setMembers] = useState<string[]>([session.name])
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null)
  const [dailyReports, setDailyReports] = useState<DailyItem[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [teamName, setTeamName] = useState('통합기술연구3팀')
  const [divisionName, setDivisionName] = useState('통합기술본부')

  const { weekStart, weekEnd } = getWeekDates(selectedDate)

  useEffect(() => {
    if (session.role === 'leader') fetchMembers()
    fetchSettings()
  }, [session.role])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.teamName) setTeamName(data.teamName)
        if (data.divisionName) setDivisionName(data.divisionName)
      }
    } catch {}
  }

  useEffect(() => {
    fetchWeeklySummary()
    fetchDailyReports()
  }, [selectedDate, selectedMember])

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/settings/members')
      if (res.ok) {
        const data = await res.json()
        setMembers(data.map((m: any) => m.name))
      }
    } catch {}
  }

  const fetchWeeklySummary = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date: selectedDate })
      if (session.role === 'leader' && selectedMember !== session.name) {
        params.set('name', selectedMember)
      }
      const res = await fetch(`/api/weekly?${params}`)
      if (res.ok) setWeeklySummary(await res.json())
    } catch {} finally {
      setLoading(false)
    }
  }

  const fetchDailyReports = async () => {
    try {
      const params = new URLSearchParams({ weekStart, weekEnd })
      if (session.role === 'leader' && selectedMember !== session.name) {
        params.set('name', selectedMember)
      }
      const res = await fetch(`/api/daily?${params}`)
      if (res.ok) setDailyReports(await res.json())
    } catch {}
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setMessage(null)
    try {
      const res = await fetch('/api/weekly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.message || `✓ "${data.title}" 주간보고가 Notion에 생성/업데이트되었습니다.`,
        })
        await fetchWeeklySummary()
      } else {
        setMessage({ type: 'error', text: data.error || '생성에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setGenerating(false)
    }
  }

  const section3Reports = dailyReports.flatMap(r =>
    r.workItems.filter(w => w.category === 'customer_support' && w.customerName)
  )

  const groupedCustomers = section3Reports.reduce((acc, item) => {
    const key = item.customerName!
    if (!acc[key]) acc[key] = {}
    const st = item.supportType || '기타'
    if (!acc[key][st]) acc[key][st] = []
    acc[key][st].push(item.content)
    return acc
  }, {} as Record<string, Record<string, string[]>>)

  const section1Reports = dailyReports.flatMap(r =>
    r.workItems.filter(w => w.category === 'project' && w.projectName)
  ).reduce((acc, item) => {
    const key = item.projectName!
    if (!acc[key]) acc[key] = []
    if (item.content) acc[key].push(item.content)
    return acc
  }, {} as Record<string, string[]>)

  const section2Reports = dailyReports.flatMap(r =>
    r.workItems.filter(w => w.category === 'achievement' && w.achievementType)
  ).reduce((acc, item) => {
    const key = item.achievementType!
    if (!acc[key]) acc[key] = []
    if (item.content) acc[key].push(item.content)
    return acc
  }, {} as Record<string, string[]>)

  const section4Reports = Array.from(new Set(
    dailyReports.flatMap(r => r.workItems.filter(w => w.category === 'planned').map(w => w.content))
  ))

  const deqItems = dailyReports.flatMap(r => r.workItems.filter(w => w.category === 'deq'))
  const lastDeq = deqItems[deqItems.length - 1]
  let deqParsed = { longPending: 0, urgent: 0 }
  if (lastDeq?.content) {
    const m = lastDeq.content.match(/long:(\d+),urgent:(\d+)/)
    if (m) deqParsed = { longPending: Number(m[1]), urgent: Number(m[2]) }
  }

  const opinionItems = Array.from(new Set(
    dailyReports.flatMap(r => r.workItems.filter(w => w.category === 'opinion').map(w => w.content))
  ))

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-notion-text">주간보고</h1>
          <div className="flex items-center gap-3">
            {session.role === 'leader' && (
              <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)} className="input-field w-36">
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <input type="week" value={`${weekStart.slice(0,4)}-W${getISOWeek(new Date(selectedDate)).toString().padStart(2,'0')}`}
              onChange={e => {
                const [y, w] = e.target.value.split('-W')
                const d = new Date(Number(y), 0, 1 + (Number(w) - 1) * 7)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              className="input-field w-40"
            />
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* 주간 요약 카드 */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-notion-gray mb-1">보고 기간</p>
              <p className="text-sm font-medium text-notion-text">{weekStart} ~ {weekEnd}</p>
              {weeklySummary?.exists && (
                <p className="text-xs text-green-600 mt-1">✓ Notion에 주간보고 존재: {weeklySummary.title}</p>
              )}
              {!weeklySummary?.exists && !loading && (
                <p className="text-xs text-notion-gray mt-1">아직 주간보고가 생성되지 않았습니다.</p>
              )}
            </div>
            <div className="flex gap-2">
              {weeklySummary?.url && (
                <a href={weeklySummary.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                  Notion에서 보기 →
                </a>
              )}
              <button onClick={handleGenerate} disabled={generating || dailyReports.length === 0} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
                {generating ? '처리 중...' : weeklySummary?.exists ? '📊 주간보고 업데이트' : '📊 주간보고 생성'}
              </button>
            </div>
          </div>
        </div>

        {/* 주간보고 미리보기 - Notion 양식과 동일 */}
        <div className="bg-white border border-notion-border rounded-lg overflow-hidden">
          {/* 목차 영역 */}
          <div className="px-8 pt-6 pb-3 border-b border-notion-border">
            <div className="text-xs text-notion-gray bg-notion-gray-bg inline-block px-2 py-1 rounded">목차</div>
          </div>

          <div className="px-8 py-6">
            {/* H1 토글 */}
            <details open className="mb-6">
              <summary className="text-2xl font-bold text-notion-text cursor-pointer hover:bg-notion-gray-bg rounded px-1 py-0.5 -mx-1 list-none flex items-center gap-2">
                <span className="text-sm text-notion-gray">▶</span>
                {divisionName} &gt; {teamName} &gt; {selectedMember}
              </summary>

              <div className="mt-4 space-y-6 pl-4">
                {/* Section 1 */}
                <div>
                  <h2 className="text-lg font-semibold text-notion-text border-b border-notion-border pb-2 mb-3">
                    1. {teamName} 주요 업무 진행 상황
                  </h2>
                  {Object.keys(section1Reports).length === 0 ? (
                    <p className="text-sm text-notion-gray ml-4">• 없음</p>
                  ) : (
                    Object.entries(section1Reports).map(([project, items]) => (
                      <div key={project} className="ml-4 mb-2">
                        <p className="text-sm text-notion-text mb-1">• <strong>{project}</strong></p>
                        {items.map((item, i) => (
                          <details key={i} className="ml-6 mb-1">
                            <summary className="text-sm text-notion-text cursor-pointer list-none flex items-center gap-1">
                              <span className="text-xs text-notion-gray">▶</span> {item}
                            </summary>
                          </details>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Section 2 */}
                <div>
                  <h2 className="text-lg font-semibold text-notion-text border-b border-notion-border pb-2 mb-3">
                    2. 주요 성과
                  </h2>
                  {Object.keys(section2Reports).length === 0 ? (
                    <p className="text-sm text-notion-gray ml-4">• 없음</p>
                  ) : (
                    Object.entries(section2Reports).map(([type, items]) => (
                      <div key={type} className="ml-4 mb-2">
                        <p className="text-sm font-medium text-notion-text mb-1">• {type}</p>
                        {items.map((item, i) => (
                          <p key={i} className="text-sm text-notion-text ml-6">• {item}</p>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Section 3 */}
                <div>
                  <h2 className="text-lg font-semibold text-notion-text border-b border-notion-border pb-2 mb-3">
                    3. 고객사 지원 주요 내역
                  </h2>
                  {Object.keys(groupedCustomers).length === 0 ? (
                    <p className="text-sm text-notion-gray ml-4">• 없음</p>
                  ) : (
                    Object.entries(groupedCustomers).map(([customer, supports]) => (
                      <div key={customer} className="ml-4 mb-3">
                        <p className="text-sm font-medium text-notion-text mb-1">• {customer} - {selectedMember}</p>
                        {Object.entries(supports).map(([type, items]) => (
                          <details key={type} className="ml-6 mb-1">
                            <summary className="text-sm text-notion-text cursor-pointer list-none flex items-center gap-1">
                              <span className="text-xs text-notion-gray">▶</span> {type}
                            </summary>
                            <div className="ml-4 mt-1">
                              {items.map((item, i) => (
                                <p key={i} className="text-sm text-notion-text">• {item}</p>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Section 4 */}
                <div>
                  <h2 className="text-lg font-semibold text-notion-text border-b border-notion-border pb-2 mb-3">
                    4. 예정된 작업
                  </h2>
                  {section4Reports.length === 0 ? (
                    <p className="text-sm text-notion-gray ml-4">• 없음</p>
                  ) : (
                    section4Reports.map((item, i) => (
                      <p key={i} className="text-sm text-notion-text ml-4">• {item}</p>
                    ))
                  )}
                </div>

                {/* Section 5 */}
                <div>
                  <h2 className="text-lg font-semibold text-notion-text border-b border-notion-border pb-2 mb-3">
                    5. DEQ 진행 상황
                  </h2>
                  {!lastDeq ? (
                    <p className="text-sm text-notion-gray ml-4">• (미입력)</p>
                  ) : (
                    <div className="ml-4 space-y-1">
                      <p className="text-sm text-notion-text">• 장기 미해결 일감 {deqParsed.longPending}건</p>
                      <p className="text-sm text-notion-text">• 우선순위 긴급 (+DSR) 진행 일감 {deqParsed.urgent}건</p>
                    </div>
                  )}
                </div>

                {/* Section 6 */}
                <div>
                  <h2 className="text-lg font-semibold text-notion-text border-b border-notion-border pb-2 mb-3">
                    6. 팀에 대한 의견
                  </h2>
                  {opinionItems.length === 0 ? (
                    <p className="text-sm text-notion-gray ml-4">• (없음)</p>
                  ) : (
                    opinionItems.map((item, i) => (
                      <p key={i} className="text-sm text-notion-text ml-4">{item}</p>
                    ))
                  )}
                </div>
              </div>
            </details>

            {/* 이번 주 일일보고 감정 요약 */}
            {dailyReports.length > 0 && (
              <div className="mt-6 pt-6 border-t border-notion-border">
                <h3 className="text-sm font-semibold text-notion-text mb-3">이번 주 감정 기록</h3>
                <div className="flex flex-wrap gap-2">
                  {[...dailyReports].sort((a,b) => a.date.localeCompare(b.date)).map(r => (
                    <div key={r.id} className="flex items-center gap-1.5 bg-notion-gray-bg rounded-md px-2 py-1">
                      <span className="text-base">{r.emotion}</span>
                      <span className="text-xs text-notion-gray">{r.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {dailyReports.length === 0 && !loading && (
          <div className="text-center py-12 text-notion-gray">
            <p className="text-4xl mb-3">📝</p>
            <p>이번 주 작성된 일일보고가 없습니다.</p>
            <a href="/daily" className="text-sm text-notion-blue hover:underline mt-2 block">일일보고 작성하러 가기 →</a>
          </div>
        )}
      </div>
    </div>
  )
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
