'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import type { JwtPayload, WorkItem, DailyReport, LegendItem, EMOTION_OPTIONS } from '@/types'
import { EMOTION_OPTIONS as EMOTIONS, ACHIEVEMENT_TYPES } from '@/types'

interface Props {
  session: JwtPayload
}

const emptyWork = (): WorkItem => ({ category: 'customer_support', content: '' })

export default function DailyReportClient({ session }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [date, setDate] = useState(today)
  const [emotion, setEmotion] = useState('')
  const [memorableEvent, setMemorableEvent] = useState('')
  const [hardThing, setHardThing] = useState('')
  const [dailyFeeling, setDailyFeeling] = useState('')

  // 업무 항목
  const [projectItems, setProjectItems] = useState<Array<{ projectName: string; content: string }>>([{ projectName: '', content: '' }])
  const [achievementItems, setAchievementItems] = useState<Array<{ achievementType: string; content: string }>>([{ achievementType: ACHIEVEMENT_TYPES[0], content: '' }])
  const [customerItems, setCustomerItems] = useState<Array<{ customerName: string; supportType: string; content: string }>>([{ customerName: '', supportType: '', content: '' }])
  const [plannedItems, setPlannedItems] = useState<string[]>([''])
  const [deqLong, setDeqLong] = useState<string>('')
  const [deqUrgent, setDeqUrgent] = useState<string>('')
  const [opinion, setOpinion] = useState('')

  const [legends, setLegends] = useState<LegendItem[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 최근 일일보고 목록
  const [recentReports, setRecentReports] = useState<DailyReport[]>([])

  useEffect(() => {
    fetchLegends()
    fetchRecentReports()
  }, [])

  const fetchLegends = async () => {
    try {
      const res = await fetch('/api/settings/legends')
      if (res.ok) setLegends(await res.json())
    } catch {}
  }

  const fetchRecentReports = async () => {
    try {
      const res = await fetch('/api/daily')
      if (res.ok) setRecentReports(await res.json())
    } catch {}
  }

  const buildWorkItems = (): WorkItem[] => {
    const items: WorkItem[] = []
    for (const p of projectItems) {
      if (p.projectName || p.content) items.push({ category: 'project', projectName: p.projectName, content: p.content })
    }
    for (const a of achievementItems) {
      if (a.content) items.push({ category: 'achievement', achievementType: a.achievementType, content: a.content })
    }
    for (const c of customerItems) {
      if (c.customerName || c.content) items.push({ category: 'customer_support', customerName: c.customerName, supportType: c.supportType, content: c.content })
    }
    for (const p of plannedItems) {
      if (p) items.push({ category: 'planned', content: p })
    }
    if (deqLong || deqUrgent) {
      items.push({ category: 'deq', content: `long:${deqLong || 0},urgent:${deqUrgent || 0}` })
    }
    if (opinion) items.push({ category: 'opinion', content: opinion })
    return items
  }

  const handleSave = async () => {
    if (!emotion) { setMessage({ type: 'error', text: '감정을 선택해주세요.' }); return }

    setSaving(true)
    setMessage(null)
    try {
      const report: DailyReport = {
        date, authorName: session.name, emotion,
        memorableEvent, hardThing, dailyFeeling,
        workItems: buildWorkItems(),
        deqStatus: (deqLong || deqUrgent) ? { longPending: Number(deqLong) || 0, urgent: Number(deqUrgent) || 0 } : undefined,
      }
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: '일일보고가 저장되었습니다.' })
        fetchRecentReports()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateWeekly = async () => {
    setGenerating(true)
    setMessage(null)
    try {
      const res = await fetch('/api/weekly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.message) {
          setMessage({ type: 'success', text: data.message })
        } else {
          setMessage({ type: 'success', text: `✓ 주간보고 생성 완료! "${data.title}" (${data.newDates?.join(', ')} 반영)` })
        }
      } else {
        setMessage({ type: 'error', text: data.error || '주간보고 생성에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '주간보고 생성 중 오류가 발생했습니다.' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-notion-text">일일보고 작성</h1>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={handleGenerateWeekly} disabled={generating} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
              {generating ? '생성 중...' : '📊 주간보고 생성'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="card">
            <h2 className="text-sm font-semibold text-notion-text mb-3">기본 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-notion-gray mb-1">날짜</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-notion-gray mb-1">작성자</label>
                <input type="text" value={session.name} readOnly className="input-field bg-notion-gray-bg cursor-not-allowed" />
              </div>
            </div>
          </div>

          {/* 감정 */}
          <div className="card">
            <h2 className="text-sm font-semibold text-notion-text mb-3">감정</h2>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map(e => (
                <button
                  key={e.emoji}
                  type="button"
                  onClick={() => setEmotion(e.emoji)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-all ${
                    emotion === e.emoji
                      ? 'border-notion-blue bg-notion-blue-bg text-notion-blue'
                      : 'border-notion-border hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{e.emoji}</span>
                  <span>{e.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 개인 회고 */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-notion-text">개인 회고</h2>
            <div>
              <label className="block text-xs text-notion-gray mb-1">기억에 남는 일</label>
              <textarea value={memorableEvent} onChange={e => setMemorableEvent(e.target.value)} rows={2} className="input-field resize-none" placeholder="오늘 기억에 남는 일을 작성하세요" />
            </div>
            <div>
              <label className="block text-xs text-notion-gray mb-1">힘들었던 점</label>
              <textarea value={hardThing} onChange={e => setHardThing(e.target.value)} rows={2} className="input-field resize-none" placeholder="힘들었던 점을 작성하세요" />
            </div>
            <div>
              <label className="block text-xs text-notion-gray mb-1">하루 느낀점</label>
              <textarea value={dailyFeeling} onChange={e => setDailyFeeling(e.target.value)} rows={2} className="input-field resize-none" placeholder="하루를 마치며 느낀점을 작성하세요" />
            </div>
          </div>

          {/* 업무 진행 상황 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-notion-text">1. 주요 업무 진행 상황</h2>
              <button type="button" onClick={() => setProjectItems(p => [...p, { projectName: '', content: '' }])} className="text-xs text-notion-blue hover:underline">+ 추가</button>
            </div>
            <div className="space-y-2">
              {projectItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.projectName} onChange={e => setProjectItems(p => p.map((x, j) => j === i ? { ...x, projectName: e.target.value } : x))} placeholder="프로젝트/업무명" className="input-field w-40 flex-shrink-0" />
                  <input value={item.content} onChange={e => setProjectItems(p => p.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} placeholder="세부 내용" className="input-field flex-1" />
                  {projectItems.length > 1 && (
                    <button type="button" onClick={() => setProjectItems(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1.5">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 주요 성과 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-notion-text">2. 주요 성과</h2>
              <button type="button" onClick={() => setAchievementItems(p => [...p, { achievementType: ACHIEVEMENT_TYPES[0], content: '' }])} className="text-xs text-notion-blue hover:underline">+ 추가</button>
            </div>
            <div className="space-y-2">
              {achievementItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={item.achievementType} onChange={e => setAchievementItems(p => p.map((x, j) => j === i ? { ...x, achievementType: e.target.value } : x))} className="input-field w-36 flex-shrink-0">
                    {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={item.content} onChange={e => setAchievementItems(p => p.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} placeholder="내용" className="input-field flex-1" />
                  {achievementItems.length > 1 && (
                    <button type="button" onClick={() => setAchievementItems(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 고객사 지원 내역 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-notion-text">3. 고객사 지원 주요 내역</h2>
              <button type="button" onClick={() => setCustomerItems(p => [...p, { customerName: '', supportType: '', content: '' }])} className="text-xs text-notion-blue hover:underline">+ 추가</button>
            </div>
            <div className="space-y-2">
              {customerItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.customerName} onChange={e => setCustomerItems(p => p.map((x, j) => j === i ? { ...x, customerName: e.target.value } : x))} placeholder="고객사명" className="input-field w-32 flex-shrink-0" />
                  <select value={item.supportType} onChange={e => setCustomerItems(p => p.map((x, j) => j === i ? { ...x, supportType: e.target.value } : x))} className="input-field w-32 flex-shrink-0">
                    <option value="">지원 종류 선택</option>
                    {legends.map(l => <option key={l.id} value={l.label}>{l.label}</option>)}
                  </select>
                  <input value={item.content} onChange={e => setCustomerItems(p => p.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} placeholder="지원 내용" className="input-field flex-1" />
                  {customerItems.length > 1 && (
                    <button type="button" onClick={() => setCustomerItems(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1.5">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 예정된 작업 */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-notion-text">4. 예정된 작업</h2>
              <button type="button" onClick={() => setPlannedItems(p => [...p, ''])} className="text-xs text-notion-blue hover:underline">+ 추가</button>
            </div>
            <div className="space-y-2">
              {plannedItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input value={item} onChange={e => setPlannedItems(p => p.map((x, j) => j === i ? e.target.value : x))} placeholder="예정된 작업 내용" className="input-field flex-1" />
                  {plannedItems.length > 1 && (
                    <button type="button" onClick={() => setPlannedItems(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1.5">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* DEQ 진행 상황 */}
          <div className="card">
            <h2 className="text-sm font-semibold text-notion-text mb-3">5. DEQ 진행 상황</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-notion-gray mb-1">장기 미해결 일감 (건)</label>
                <input type="number" min="0" value={deqLong} onChange={e => setDeqLong(e.target.value)} placeholder="0" className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-notion-gray mb-1">우선순위 긴급 (+DSR) 일감 (건)</label>
                <input type="number" min="0" value={deqUrgent} onChange={e => setDeqUrgent(e.target.value)} placeholder="0" className="input-field" />
              </div>
            </div>
          </div>

          {/* 팀에 대한 의견 */}
          <div className="card">
            <h2 className="text-sm font-semibold text-notion-text mb-3">6. 팀에 대한 의견</h2>
            <textarea value={opinion} onChange={e => setOpinion(e.target.value)} rows={3} className="input-field resize-none" placeholder="팀이나 본부에 대한 건의 사항이 있을 경우 작성하세요" />
          </div>
        </div>

        {/* 최근 일일보고 목록 */}
        {recentReports.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-notion-text mb-3">최근 일일보고</h2>
            <div className="space-y-2">
              {recentReports.slice(0, 5).map(r => (
                <div key={r.id} className="card flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{r.emotion}</span>
                    <div>
                      <p className="text-sm font-medium text-notion-text">{r.date}</p>
                      <p className="text-xs text-notion-gray line-clamp-1">{r.memorableEvent || '(내용 없음)'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-notion-gray">{r.workItems.length}개 업무</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
