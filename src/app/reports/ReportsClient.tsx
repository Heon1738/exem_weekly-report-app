'use client'

import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload, WeeklyDraft, DailyReport } from '@/types'

// ─── Types ────────────────────────────────────────────
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

interface WeekOption {
  label: string
  weekStart: string
  weekEnd: string
}

interface ModalState {
  type: 'weekly' | 'daily'
  member: string
  weekStart: string
  weekEnd: string
}

// ─── Utilities ───────────────────────────────────────
function getWeekRange(dateStr: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon = new Date(date); mon.setDate(date.getDate() + diff)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
  return { weekStart: fmt(mon), weekEnd: fmt(fri) }
}

function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-').map(Number)
  return `${m}월 ${Math.ceil((d - 1) / 7) + 1}주차`
}

function formatMD(dateStr: string): string {
  return dateStr.slice(5).replace('-', '/')
}

function daysAgo(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86400000)
}

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekOptions(count = 8): WeekOption[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i * 7)
    const { weekStart, weekEnd } = getWeekRange(localDate(d))
    const lbl = weekLabel(weekStart)
    return { weekStart, weekEnd, label: i === 0 ? `이번주 (${lbl})` : i === 1 ? `지난주 (${lbl})` : lbl }
  })
}

function ageBadgeColor(days: number, thresholds: [number, number]) {
  return days <= thresholds[0] ? 'text-green-600' : days <= thresholds[1] ? 'text-yellow-600' : 'text-red-500'
}

// ─── Modal Shell ─────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-notion-border shrink-0">
          <h2 className="text-sm font-semibold text-notion-text truncate pr-4">{title}</h2>
          <button onClick={onClose} className="shrink-0 text-notion-gray hover:text-notion-text text-lg leading-none">✕</button>
        </div>
        <div className="overflow-y-auto p-5 flex-1 text-sm space-y-1">{children}</div>
      </div>
    </div>
  )
}

// ─── Weekly Draft Viewer ──────────────────────────────
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3 first:pt-0">
      <p className="text-xs font-semibold text-notion-blue mb-1.5">{title}</p>
      <div className="space-y-1 text-notion-text">{children}</div>
    </div>
  )
}

function WeeklyDraftViewer({ member, weekStart, weekEnd, onClose }: {
  member: string; weekStart: string; weekEnd: string; onClose: () => void
}) {
  const [draft, setDraft] = useState<WeeklyDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/weekly?name=${encodeURIComponent(member)}&date=${weekStart}`)
      .then(r => r.json())
      .then(d => { setDraft(d); setLoading(false) })
      .catch(() => { setError('불러오기 실패'); setLoading(false) })
  }, [member, weekStart])

  const title = `${member} · ${weekLabel(weekStart)} 주간보고 (${formatMD(weekStart)} ~ ${formatMD(weekEnd)})`

  return (
    <Modal title={title} onClose={onClose}>
      {loading ? <p className="text-notion-gray">불러오는 중...</p>
        : error ? <p className="text-red-500">{error}</p>
        : draft ? (
          <div className="divide-y divide-notion-border">
            <SectionBlock title="1. 주요 업무 진행 상황">
              {draft.section1.filter(i => i.projectName).length === 0
                ? <p className="text-notion-gray text-xs">없음</p>
                : draft.section1.filter(i => i.projectName).map((i, idx) => (
                  <div key={idx} className="ml-2">
                    <p className="font-medium">• {i.projectName}</p>
                    {i.content && <p className="ml-4 text-notion-gray text-xs whitespace-pre-wrap">{i.content}</p>}
                  </div>
                ))}
            </SectionBlock>
            <SectionBlock title="2. 주요 성과">
              {draft.section2.filter(i => i.achievementType).length === 0
                ? <p className="text-notion-gray text-xs">없음</p>
                : draft.section2.filter(i => i.achievementType).map((i, idx) => (
                  <div key={idx} className="ml-2">
                    <p className="font-medium">• {i.achievementType}</p>
                    {i.content && <p className="ml-4 text-notion-gray text-xs whitespace-pre-wrap">{i.content}</p>}
                  </div>
                ))}
            </SectionBlock>
            <SectionBlock title="3. 고객사 지원 주요 내역">
              {draft.section3.filter(i => i.customerName).length === 0
                ? <p className="text-notion-gray text-xs">없음</p>
                : draft.section3.filter(i => i.customerName).map((i, idx) => (
                  <div key={idx} className="ml-2">
                    <p className="font-medium">• {i.customerName}</p>
                    {i.supportType && <p className="ml-4 text-notion-gray text-xs">지원 종류: {i.supportType}</p>}
                    {i.content && <p className="ml-4 text-notion-gray text-xs whitespace-pre-wrap">{i.content}</p>}
                  </div>
                ))}
            </SectionBlock>
            <SectionBlock title="4. 예정된 작업">
              {draft.section4.filter(Boolean).length === 0
                ? <p className="text-notion-gray text-xs">없음</p>
                : draft.section4.filter(Boolean).map((s, idx) => <p key={idx} className="ml-2">• {s}</p>)}
            </SectionBlock>
            <SectionBlock title="5. DEQ 진행 상황">
              {draft.section5.filter(i => i.description).length === 0
                ? <p className="text-notion-gray text-xs">없음</p>
                : draft.section5.filter(i => i.description).map((i, idx) => (
                  <div key={idx} className="ml-2">
                    <p>• {i.description}</p>
                    {i.link && <a href={i.link} target="_blank" rel="noopener noreferrer"
                      className="ml-4 text-notion-blue hover:underline text-xs">{i.link}</a>}
                  </div>
                ))}
            </SectionBlock>
            <SectionBlock title="6. 팀에 대한 의견">
              <p className="ml-2 whitespace-pre-wrap">{draft.section6 || '—'}</p>
            </SectionBlock>
          </div>
        ) : null}
    </Modal>
  )
}

// ─── Daily Reports Viewer ────────────────────────────
function DailyReportsViewer({ member, weekStart, weekEnd, onClose }: {
  member: string; weekStart: string; weekEnd: string; onClose: () => void
}) {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/daily?name=${encodeURIComponent(member)}&weekStart=${weekStart}&weekEnd=${weekEnd}`)
      .then(r => r.json())
      .then(d => { setReports(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [member, weekStart, weekEnd])

  const title = `${member} · ${weekLabel(weekStart)} 일일보고 (${formatMD(weekStart)} ~ ${formatMD(weekEnd)})`

  return (
    <Modal title={title} onClose={onClose}>
      {loading ? <p className="text-notion-gray">불러오는 중...</p>
        : reports.length === 0 ? <p className="text-notion-gray">작성된 일일보고가 없습니다.</p>
        : (
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className="border border-notion-border rounded-md p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-notion-text">{r.date}</span>
                  {r.emotion && <span className="text-base">{r.emotion}</span>}
                  {r.customerName && (
                    <span className="text-xs bg-notion-gray-bg text-notion-gray px-1.5 py-0.5 rounded">{r.customerName}</span>
                  )}
                </div>
                {r.memorableEvent && (
                  <div className="text-xs"><span className="text-notion-gray">기억에 남는 일: </span>{r.memorableEvent}</div>
                )}
                {r.hardThing && (
                  <div className="text-xs"><span className="text-notion-gray">힘들었던 점: </span>{r.hardThing}</div>
                )}
                {r.dailyFeeling && (
                  <div className="text-xs whitespace-pre-wrap"><span className="text-notion-gray">하루 느낀점: </span>{r.dailyFeeling}</div>
                )}
              </div>
            ))}
          </div>
        )}
    </Modal>
  )
}

// ─── Export Section ───────────────────────────────────
type ExportResult = { name: string; pageId: string; error?: string }

function ExportSection() {
  const weekOptions = getWeekOptions(8)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [results, setResults] = useState<ExportResult[] | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setResults(null)
    const { weekStart, weekEnd } = weekOptions[selectedIdx]
    try {
      const res = await fetch('/api/weekly/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd }),
      })
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    }
    setExporting(false)
  }

  return (
    <div className="card mb-6">
      <p className="text-sm font-semibold text-notion-text mb-3">📤 전체 Notion 내보내기</p>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedIdx}
          onChange={e => { setSelectedIdx(Number(e.target.value)); setResults(null) }}
          className="input-field w-auto text-sm"
          disabled={exporting}
        >
          {weekOptions.map((w, i) => (
            <option key={w.weekStart} value={i}>{w.label}</option>
          ))}
        </select>
        <button onClick={handleExport} disabled={exporting} className="btn-primary text-sm">
          {exporting ? '내보내는 중...' : 'Notion으로 전체 내보내기'}
        </button>
      </div>

      {results && (
        <div className="mt-3 pt-3 border-t border-notion-border space-y-1.5">
          {results.length === 0
            ? <p className="text-xs text-notion-gray">내보낼 팀원이 없습니다.</p>
            : results.map(r => (
              <div key={r.name} className="flex items-start gap-2 text-xs">
                <span className={r.error ? 'text-red-500' : 'text-green-600'}>{r.error ? '✗' : '✓'}</span>
                <span className="font-medium text-notion-text">{r.name}</span>
                <span className={r.error ? 'text-red-400' : 'text-notion-gray'}>
                  {r.error || '내보내기 완료'}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Member Card ──────────────────────────────────────
function MemberCard({ member, onView }: { member: MemberSummary; onView: (s: ModalState) => void }) {
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="font-medium text-notion-text">{member.name}</span>
          {member.position && <span className="text-xs text-notion-gray">{member.position}</span>}
          {member.department && <span className="text-xs text-notion-gray">· {member.department}</span>}
        </div>
        <button onClick={toggle} className="shrink-0 text-xs text-notion-blue hover:underline">
          {loading ? '로딩...' : expanded ? '접기 ▲' : '주간보고 목록 ▼'}
        </button>
      </div>

      {/* Summary row */}
      <div className="flex flex-wrap gap-6 mt-3">
        <div>
          <p className="text-xs text-notion-gray mb-1">최근 일일보고 <span className="font-normal">(클릭하여 보기)</span></p>
          {member.lastDailyDate ? (
            <button
              className={`text-sm font-medium hover:underline underline-offset-2 ${ageBadgeColor(daysAgo(member.lastDailyDate), [7, 14])}`}
              onClick={() => {
                const { weekStart, weekEnd } = getWeekRange(member.lastDailyDate!)
                onView({ type: 'daily', member: member.name, weekStart, weekEnd })
              }}
            >
              {member.lastDailyDate}
            </button>
          ) : <span className="text-sm text-notion-gray">미작성</span>}
        </div>
        <div>
          <p className="text-xs text-notion-gray mb-1">최근 주간보고 <span className="font-normal">(클릭하여 보기)</span></p>
          {member.lastWeeklyStart ? (
            <button
              className={`text-sm font-medium hover:underline underline-offset-2 ${ageBadgeColor(daysAgo(member.lastWeeklyStart), [10, 20])}`}
              onClick={() => {
                const { weekStart, weekEnd } = getWeekRange(member.lastWeeklyStart!)
                onView({ type: 'weekly', member: member.name, weekStart, weekEnd })
              }}
            >
              {member.lastWeeklyStart}
              <span className="ml-1 font-normal text-notion-gray text-xs">({weekLabel(member.lastWeeklyStart)})</span>
            </button>
          ) : <span className="text-sm text-notion-gray">미작성</span>}
        </div>
      </div>

      {/* Expanded weekly list */}
      {expanded && weeklyList !== null && (
        <div className="mt-3 pt-3 border-t border-notion-border">
          <p className="text-xs text-notion-gray font-medium mb-2">주간보고 작성 내역</p>
          {weeklyList.length === 0 ? (
            <p className="text-xs text-notion-gray">작성된 주간보고가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {weeklyList.map(w => (
                <li key={w.weekStart} className="flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-notion-text">{weekLabel(w.weekStart)}</span>
                    <span className="text-notion-gray">({formatMD(w.weekStart)} ~ {formatMD(w.weekEnd)})</span>
                    <span className="text-notion-gray">
                      · 수정: {new Date(w.updatedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      className="text-notion-blue hover:underline"
                      onClick={() => onView({ type: 'weekly', member: member.name, weekStart: w.weekStart, weekEnd: w.weekEnd })}
                    >주간보고 보기</button>
                    <button
                      className="text-notion-blue hover:underline"
                      onClick={() => onView({ type: 'daily', member: member.name, weekStart: w.weekStart, weekEnd: w.weekEnd })}
                    >일일보고 보기</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────
export default function ReportsClient({ session }: { session: JwtPayload }) {
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)

  useEffect(() => {
    fetch('/api/reports/summary')
      .then(r => r.json())
      .then(data => { setMembers(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleView = useCallback((s: ModalState) => setModal(s), [])
  const closeModal = useCallback(() => setModal(null), [])

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-notion-text mb-1">보고 관리</h1>
        <p className="text-sm text-notion-gray mb-6">팀원별 보고 현황 · 날짜 또는 주간보고 목록에서 내용 확인 가능</p>

        <ExportSection />

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
              {members.map(m => <MemberCard key={m.name} member={m} onView={handleView} />)}
            </div>
          </>
        )}
      </div>

      {modal?.type === 'weekly' && (
        <WeeklyDraftViewer
          member={modal.member} weekStart={modal.weekStart} weekEnd={modal.weekEnd} onClose={closeModal}
        />
      )}
      {modal?.type === 'daily' && (
        <DailyReportsViewer
          member={modal.member} weekStart={modal.weekStart} weekEnd={modal.weekEnd} onClose={closeModal}
        />
      )}
    </div>
  )
}
