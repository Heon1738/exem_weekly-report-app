'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import type { JwtPayload, DailyReport } from '@/types'
import { EMOTION_OPTIONS } from '@/types'

interface Props { session: JwtPayload }

const emptyForm = (name: string): DailyReport => ({
  date: new Date().toISOString().split('T')[0],
  authorName: name,
  customerName: '',
  emotion: '',
  memorableEvent: '',
  hardThing: '',
  dailyFeeling: '',
})

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]
  return { weekStart: fmt(mon), weekEnd: fmt(fri) }
}

export default function DailyReportClient({ session }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<DailyReport>(emptyForm(session.name))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [recentReports, setRecentReports] = useState<DailyReport[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [autoFilling, setAutoFilling] = useState(false)
  const [weeklyGenerating, setWeeklyGenerating] = useState(false)
  const [generateResults, setGenerateResults] = useState<{ weekStart: string; weekEnd: string; success: boolean; error?: string }[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedWeekStarts, setSelectedWeekStarts] = useState<string[]>([])

  const today = new Date().toISOString().split('T')[0]
  const { weekStart, weekEnd } = getWeekRange(today)

  // 일일보고가 있는 모든 주차 추출
  const uniqueWeeks = (() => {
    const map = new Map<string, { weekEnd: string; count: number }>()
    for (const r of recentReports) {
      const { weekStart: ws, weekEnd: we } = getWeekRange(r.date)
      if (!map.has(ws)) map.set(ws, { weekEnd: we, count: 0 })
      map.get(ws)!.count++
    }
    return Array.from(map.entries())
      .map(([ws, { weekEnd: we, count }]) => ({ weekStart: ws, weekEnd: we, count }))
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  })()

  useEffect(() => { fetchRecentReports() }, [])

  // 일일보고가 로드되면 현재 주차 자동 선택 (없으면 가장 최근 주차)
  useEffect(() => {
    if (recentReports.length > 0 && selectedWeekStarts.length === 0) {
      const hasCurrentWeek = recentReports.some(r => getWeekRange(r.date).weekStart === weekStart)
      const firstWeek = uniqueWeeks[0]?.weekStart
      if (hasCurrentWeek) setSelectedWeekStarts([weekStart])
      else if (firstWeek) setSelectedWeekStarts([firstWeek])
    }
  }, [recentReports])

  const fetchRecentReports = async () => {
    try {
      const res = await fetch('/api/daily')
      if (res.ok) setRecentReports(await res.json())
    } catch {}
  }

  const handleAutoFill = async () => {
    if (!form.dailyFeeling.trim()) {
      setMessage({ type: 'error', text: '먼저 하루 느낀점을 입력해주세요.' })
      return
    }
    setAutoFilling(true)
    setMessage(null)
    try {
      const res = await fetch('/api/daily/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyFeeling: form.dailyFeeling }),
      })
      if (res.ok) {
        const filled = await res.json()
        setForm(f => ({ ...f, ...filled }))
        setMessage({ type: 'success', text: '자동 채우기 완료! 내용을 확인하고 수정해주세요.' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '자동 채우기에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '자동 채우기 중 오류가 발생했습니다.' })
    } finally {
      setAutoFilling(false)
    }
  }

  const fmtWeekLabel = (weekStart: string) => {
    const [, m, d] = weekStart.split('-').map(Number)
    return `${m}월 ${Math.ceil((d - 1) / 7) + 1}주차`
  }

  const toggleWeekSelect = (ws: string) => {
    setSelectedWeekStarts(prev =>
      prev.includes(ws) ? prev.filter(x => x !== ws) : [...prev, ws]
    )
  }

  const handleGenerateWeekly = async () => {
    const weeks = uniqueWeeks.filter(w => selectedWeekStarts.includes(w.weekStart))
    if (weeks.length === 0) {
      setMessage({ type: 'error', text: '생성할 주차를 선택해주세요.' })
      return
    }
    setWeeklyGenerating(true)
    setGenerateResults([])
    setMessage(null)
    const results: typeof generateResults = []
    for (const week of weeks) {
      try {
        const res = await fetch('/api/weekly/autofill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: week.weekStart }),
        })
        if (res.ok) {
          results.push({ weekStart: week.weekStart, weekEnd: week.weekEnd, success: true })
        } else {
          const data = await res.json()
          results.push({ weekStart: week.weekStart, weekEnd: week.weekEnd, success: false, error: data.error })
        }
      } catch {
        results.push({ weekStart: week.weekStart, weekEnd: week.weekEnd, success: false, error: '오류 발생' })
      }
      setGenerateResults([...results])
    }
    setWeeklyGenerating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 일일보고를 삭제하시겠습니까?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/daily/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMessage({ type: 'success', text: '삭제되었습니다.' })
        await fetchRecentReports()
        if (editingId === id) handleCancelEdit()
      } else {
        setMessage({ type: 'error', text: '삭제에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSave = async () => {
    if (!form.dailyFeeling.trim()) {
      setMessage({ type: 'error', text: '하루 느낀점을 입력해주세요.' }); return
    }
    if (!form.emotion) {
      setMessage({ type: 'error', text: '감정을 선택해주세요.' }); return
    }

    setSaving(true); setMessage(null)
    try {
      let res
      if (editingId) {
        res = await fetch(`/api/daily/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        res = await fetch('/api/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }

      if (res.ok) {
        setMessage({ type: 'success', text: editingId ? '수정되었습니다.' : '저장되었습니다.' })
        setEditingId(null)
        setForm(emptyForm(session.name))
        await fetchRecentReports()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally { setSaving(false) }
  }

  const handleEdit = (report: DailyReport) => {
    setForm({ ...report })
    setEditingId(report.id!)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm(session.name))
    setMessage(null)
  }

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-notion-text">
              {editingId ? '일일보고 수정' : '일일보고 작성'}
            </h1>
            {editingId && (
              <p className="text-xs text-notion-gray mt-0.5">{form.date} 보고서 수정 중</p>
            )}
          </div>
          <div className="flex gap-2">
            {editingId && (
              <button onClick={handleCancelEdit} className="btn-secondary">취소</button>
            )}
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? '저장 중...' : editingId ? '수정 완료' : '저장'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {/* 날짜 / 작성자 */}
          <div className="card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-notion-gray mb-1">날짜</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  disabled={!!editingId}
                  className={`input-field ${editingId ? 'bg-notion-gray-bg cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-notion-gray mb-1">작성자</label>
                <input type="text" value={session.name} readOnly className="input-field bg-notion-gray-bg cursor-not-allowed" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs text-notion-gray mb-1">고객사명</label>
              <input
                type="text"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                className="input-field"
                placeholder="ex. 삼성전자, 한국전력 (없으면 비워두세요)"
              />
            </div>
          </div>

          {/* 하루 느낀점 - 메인 입력 */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-notion-text">
                하루 느낀점 <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoFill}
                disabled={autoFilling}
                className="text-xs bg-notion-blue text-white px-2.5 py-1 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60"
              >
                {autoFilling ? '분석 중...' : '✨ 자동 채우기'}
              </button>
            </div>
            <textarea
              value={form.dailyFeeling}
              onChange={e => setForm(f => ({ ...f, dailyFeeling: e.target.value }))}
              rows={4}
              className="input-field resize-none"
              placeholder="오늘 하루를 자유롭게 작성해주세요. 작성 후 '자동 채우기'를 누르면 감정과 기억에 남는 일, 힘들었던 점이 자동으로 채워집니다."
            />
          </div>

          {/* 감정 */}
          <div className="card">
            <label className="block text-sm font-semibold text-notion-text mb-3">
              감정 <span className="text-red-400">*</span>
              <span className="text-xs font-normal text-notion-gray ml-2">(자동 채우기로 추천되며 직접 선택 가능)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOTION_OPTIONS.map(e => (
                <button
                  key={e.emoji}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, emotion: e.emoji }))}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-all ${
                    form.emotion === e.emoji
                      ? 'border-notion-blue bg-notion-blue-bg text-notion-blue font-medium'
                      : 'border-notion-border hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{e.emoji}</span>
                  <span>{e.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 기억에 남는 일 / 힘들었던 점 */}
          <div className="card space-y-3">
            <p className="text-xs text-notion-gray">아래 내용은 자동 채우기로 생성되며 직접 수정할 수 있습니다.</p>
            <div>
              <label className="block text-xs font-medium text-notion-text mb-1">기억에 남는 일</label>
              <textarea
                value={form.memorableEvent}
                onChange={e => setForm(f => ({ ...f, memorableEvent: e.target.value }))}
                rows={2}
                className="input-field resize-none"
                placeholder="오늘 기억에 남는 일 (자동 채우기 또는 직접 입력)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-notion-text mb-1">힘들었던 점</label>
              <textarea
                value={form.hardThing}
                onChange={e => setForm(f => ({ ...f, hardThing: e.target.value }))}
                rows={2}
                className="input-field resize-none"
                placeholder="힘들었던 점 (자동 채우기 또는 직접 입력)"
              />
            </div>
          </div>
        </div>

        {/* 주간보고 자동생성 배너 */}
        <div className="mt-8 p-4 rounded-lg border border-notion-border bg-white">
          <p className="text-sm font-medium text-notion-text mb-1">📊 주간보고 자동생성</p>
          <p className="text-xs text-notion-gray mb-3">
            {uniqueWeeks.length > 0
              ? '생성할 주차를 선택하세요. 기존 작성 내용은 보존되며, 일일보고 기반 섹션(고객사 지원·예정 작업)만 갱신됩니다.'
              : '작성된 일일보고가 없습니다.'}
          </p>

          {/* 주차 선택 체크박스 */}
          {uniqueWeeks.length > 0 && !weeklyGenerating && generateResults.length === 0 && (
            <div className="space-y-1.5 mb-3">
              {uniqueWeeks.map(w => (
                <label key={w.weekStart} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedWeekStarts.includes(w.weekStart)}
                    onChange={() => toggleWeekSelect(w.weekStart)}
                    className="w-3.5 h-3.5 accent-notion-blue"
                  />
                  <span className="text-xs text-notion-text group-hover:text-notion-blue">
                    {fmtWeekLabel(w.weekStart)}
                    <span className="text-notion-gray ml-1">({w.count}일 작성)</span>
                    {w.weekStart === weekStart && (
                      <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1 rounded">이번 주</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* 생성 진행 중 */}
          {weeklyGenerating && (
            <p className="text-xs text-notion-blue mb-3">
              진행 중... ({generateResults.length + 1}/{selectedWeekStarts.length})
            </p>
          )}

          {/* 생성 결과 */}
          {generateResults.length > 0 && !weeklyGenerating && (
            <div className="mb-3 space-y-0.5">
              {generateResults.map(r => (
                <p key={r.weekStart} className={`text-xs ${r.success ? 'text-green-600' : 'text-red-500'}`}>
                  {r.success ? '✓' : '✗'} {fmtWeekLabel(r.weekStart)} {r.success ? '생성 완료' : r.error}
                </p>
              ))}
              {generateResults.every(r => r.success) && (
                <button onClick={() => router.push('/weekly')} className="text-xs text-notion-blue hover:underline mt-1">
                  → 주간보고 페이지로 이동
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleGenerateWeekly}
            disabled={weeklyGenerating || selectedWeekStarts.length === 0}
            className="text-sm bg-notion-blue text-white px-3 py-2 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {weeklyGenerating
              ? `생성 중... (${generateResults.length}/${selectedWeekStarts.length})`
              : `주간보고 자동생성${selectedWeekStarts.length > 0 ? ` (${selectedWeekStarts.length}주차)` : ''}`}
          </button>
        </div>

        {/* 최근 일일보고 목록 */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-notion-text mb-3">최근 일일보고</h2>
          {recentReports.length === 0 ? (
            <p className="text-sm text-notion-gray">작성된 일일보고가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {recentReports.slice(0, 10).map(r => (
                <div
                  key={r.id}
                  className={`card flex items-center justify-between py-3 ${editingId === r.id ? 'border-notion-blue bg-notion-blue-bg' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{r.emotion || '📝'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-notion-text">{r.date}</p>
                        {r.date >= weekStart && r.date <= weekEnd && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">이번 주</span>
                        )}
                      </div>
                      <p className="text-xs text-notion-gray line-clamp-1 max-w-xs">
                        {r.dailyFeeling || '(내용 없음)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(r)}
                      disabled={!!editingId && editingId !== r.id}
                      className="text-xs text-notion-blue hover:underline disabled:opacity-40"
                    >
                      {editingId === r.id ? '수정 중...' : '수정'}
                    </button>
                    <button
                      onClick={() => handleDelete(r.id!)}
                      disabled={deletingId === r.id || !!editingId}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                    >
                      {deletingId === r.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
