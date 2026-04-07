'use client'

import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload, WeeklyDraft, LegendItem } from '@/types'
import { ACHIEVEMENT_TYPES } from '@/types'

interface Props { session: JwtPayload }

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]
  return { weekStart: fmt(mon), weekEnd: fmt(fri) }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function emptyDraft(authorName: string, weekStart: string, weekEnd: string): WeeklyDraft {
  return {
    weekStart, weekEnd, authorName,
    section1: [{ projectName: '', content: '' }],
    section2: [{ achievementType: ACHIEVEMENT_TYPES[0], content: '' }],
    section3: [{ customerName: '', supportType: '', content: '' }],
    section4: [''],
    section5: [{ description: '', link: '' }],
    section6: '',
    mappedDates: [],
  }
}

export default function WeeklyReportClient({ session }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedMember, setSelectedMember] = useState(session.name)
  const [members, setMembers] = useState<string[]>([session.name])
  const [legends, setLegends] = useState<LegendItem[]>([])
  const [teamName, setTeamName] = useState('통합기술연구3팀')
  const [divisionName, setDivisionName] = useState('통합기술본부')

  const { weekStart, weekEnd } = getWeekRange(selectedDate)
  const [draft, setDraft] = useState<WeeklyDraft>(emptyDraft(session.name, weekStart, weekEnd))
  const [autoSection6, setAutoSection6] = useState('')
  const [dailySummary, setDailySummary] = useState<Array<{ date: string; emotion: string; dailyFeeling: string }>>([])

  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [notionUrl, setNotionUrl] = useState<string | null>(null)
  const [bulkExporting, setBulkExporting] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ name: string; pageId: string; error?: string }[] | null>(null)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [weeklyList, setWeeklyList] = useState<{ weekStart: string; weekEnd: string; updatedAt: string }[]>([])
  const [deletingWeek, setDeletingWeek] = useState<string | null>(null)

  const isPrivileged = session.role === 'leader' || session.role === 'admin'
  const isAdmin = session.role === 'admin'

  useEffect(() => {
    if (isPrivileged) fetchMembers()
    fetchLegends()
    fetchSettings()
  }, [])

  useEffect(() => { loadDraft() }, [selectedDate, selectedMember])
  useEffect(() => { fetchWeeklyList() }, [selectedMember])

  const fetchMembers = async () => {
    const res = await fetch('/api/settings/members')
    if (res.ok) setMembers((await res.json()).map((m: any) => m.name))
  }

  const fetchWeeklyList = async () => {
    try {
      const params = new URLSearchParams()
      if (isPrivileged && selectedMember !== session.name) params.set('name', selectedMember)
      const res = await fetch(`/api/weekly/list?${params}`)
      if (res.ok) setWeeklyList(await res.json())
    } catch {}
  }

  const fetchLegends = async () => {
    const res = await fetch('/api/settings/legends')
    if (res.ok) setLegends(await res.json())
  }

  const fetchSettings = async () => {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const d = await res.json()
      if (d.teamName) setTeamName(d.teamName)
      if (d.divisionName) setDivisionName(d.divisionName)
    }
  }

  const loadDraft = async () => {
    setLoading(true); setMessage(null); setNotionUrl(null)
    try {
      const params = new URLSearchParams({ date: selectedDate })
      if (isPrivileged && selectedMember !== session.name) params.set('name', selectedMember)
      const res = await fetch(`/api/weekly?${params}`)
      if (res.ok) {
        const data = await res.json()
        const { autoSection6: auto, dailyReports, ...draftData } = data
        // 구버전 section5 호환 ({longPending, urgent} → 배열)
        if (draftData.section5 && !Array.isArray(draftData.section5)) {
          draftData.section5 = [{ description: '', link: '' }]
        }
        setDraft(draftData)
        setAutoSection6(auto || '')
        setDailySummary(dailyReports || [])
      }
    } catch {} finally { setLoading(false) }
  }

  const handleSaveDraft = async () => {
    setSaving(true); setMessage(null)
    try {
      const res = await fetch('/api/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: '초안이 저장되었습니다.' })
        fetchWeeklyList()
      } else setMessage({ type: 'error', text: '저장에 실패했습니다.' })
    } catch {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' })
    } finally { setSaving(false) }
  }

  const handleExport = async () => {
    setExporting(true); setMessage(null)
    try {
      const res = await fetch('/api/weekly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: '✓ Notion으로 내보내기 완료!' })
        if (data.pageId) setNotionUrl(`https://www.notion.so/${data.pageId.replace(/-/g, '')}`)
      } else {
        setMessage({ type: 'error', text: data.error || '내보내기에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '오류가 발생했습니다.' })
    } finally { setExporting(false) }
  }

  const handleBulkExport = async () => {
    setBulkExporting(true)
    setBulkResults(null)
    setMessage(null)
    try {
      const res = await fetch('/api/weekly/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd }),
      })
      const data = await res.json()
      if (res.ok) {
        setBulkResults(data.results)
      } else {
        setMessage({ type: 'error', text: data.error || '전체 내보내기에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '전체 내보내기 중 오류가 발생했습니다.' })
    } finally {
      setBulkExporting(false)
    }
  }

  const applyAutoSection6 = () => {
    setDraft(d => ({ ...d, section6: autoSection6 }))
  }

  // 섹션별 핸들러
  const addS1 = () => setDraft(d => ({ ...d, section1: [...d.section1, { projectName: '', content: '' }] }))
  const removeS1 = (i: number) => setDraft(d => ({ ...d, section1: d.section1.filter((_, j) => j !== i) }))
  const updateS1 = (i: number, key: 'projectName' | 'content', val: string) =>
    setDraft(d => ({ ...d, section1: d.section1.map((x, j) => j === i ? { ...x, [key]: val } : x) }))

  const addS2 = () => setDraft(d => ({ ...d, section2: [...d.section2, { achievementType: ACHIEVEMENT_TYPES[0], content: '' }] }))
  const removeS2 = (i: number) => setDraft(d => ({ ...d, section2: d.section2.filter((_, j) => j !== i) }))
  const updateS2 = (i: number, key: 'achievementType' | 'content', val: string) =>
    setDraft(d => ({ ...d, section2: d.section2.map((x, j) => j === i ? { ...x, [key]: val } : x) }))

  const addS3 = () => setDraft(d => ({ ...d, section3: [...d.section3, { customerName: '', supportType: '', content: '' }] }))
  const removeS3 = (i: number) => setDraft(d => ({ ...d, section3: d.section3.filter((_, j) => j !== i) }))
  const updateS3 = (i: number, key: keyof WeeklyDraft['section3'][0], val: string) =>
    setDraft(d => ({ ...d, section3: d.section3.map((x, j) => j === i ? { ...x, [key]: val } : x) }))

  const addS4 = () => setDraft(d => ({ ...d, section4: [...d.section4, ''] }))
  const removeS4 = (i: number) => setDraft(d => ({ ...d, section4: d.section4.filter((_, j) => j !== i) }))
  const updateS4 = (i: number, val: string) =>
    setDraft(d => ({ ...d, section4: d.section4.map((x, j) => j === i ? val : x) }))

  const addS5 = () => setDraft(d => ({ ...d, section5: [...d.section5, { description: '', link: '' }] }))
  const removeS5 = (i: number) => setDraft(d => ({ ...d, section5: d.section5.filter((_, j) => j !== i) }))
  const updateS5 = (i: number, key: 'description' | 'link', val: string) =>
    setDraft(d => ({ ...d, section5: d.section5.map((x, j) => j === i ? { ...x, [key]: val } : x) }))

  const weekLabel = `${weekStart} ~ ${weekEnd}`

  const handleSelectWeek = (ws: string) => {
    setSelectedDate(ws)
  }

  const handleDeleteWeek = async (ws: string) => {
    if (!confirm(`${ws} 주간보고를 삭제하시겠습니까?`)) return
    setDeletingWeek(ws)
    try {
      const body: Record<string, string> = { weekStart: ws }
      if (isPrivileged && selectedMember !== session.name) body.authorName = selectedMember
      const res = await fetch('/api/weekly/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await fetchWeeklyList()
        if (ws === weekStart) {
          const today = new Date().toISOString().split('T')[0]
          setSelectedDate(today)
        }
      } else {
        setMessage({ type: 'error', text: '삭제에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '삭제 중 오류가 발생했습니다.' })
    } finally {
      setDeletingWeek(null)
    }
  }

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-notion-text">주간보고</h1>
            <p className="text-xs text-notion-gray mt-0.5">{weekLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isPrivileged && (
              <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)} className="input-field w-32 text-sm">
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            <input
              type="week"
              value={`${new Date(weekStart).getFullYear()}-W${getISOWeek(new Date(selectedDate)).toString().padStart(2, '0')}`}
              onChange={e => {
                const [y, w] = e.target.value.split('-W')
                const d = new Date(Number(y), 0, 1 + (Number(w) - 1) * 7)
                setSelectedDate(d.toISOString().split('T')[0])
              }}
              className="input-field w-40 text-sm"
            />
            <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary text-sm">
              {saving ? '저장 중...' : '초안 저장'}
            </button>
            {isPrivileged && !isAdmin && (
              <button onClick={handleBulkExport} disabled={bulkExporting} className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {bulkExporting ? '처리 중...' : '📤 전체 내보내기'}
              </button>
            )}
            {!isAdmin && (
              <button onClick={handleExport} disabled={exporting} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {exporting ? '처리 중...' : '📤 Notion 내보내기'}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
            {notionUrl && <a href={notionUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline">Notion에서 열기 →</a>}
          </div>
        )}

        {bulkResults && (
          <div className="mb-4 p-3 rounded-md text-sm bg-purple-50 border border-purple-200">
            <p className="font-medium text-purple-800 mb-2">전체 내보내기 결과</p>
            <div className="space-y-1">
              {bulkResults.map(r => (
                <div key={r.name} className="flex items-center gap-2">
                  {r.error ? (
                    <span className="text-red-600">✗ {r.name}: {r.error}</span>
                  ) : (
                    <>
                      <span className="text-green-700">✓ {r.name}</span>
                      {r.pageId && (
                        <a href={`https://www.notion.so/${r.pageId.replace(/-/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline text-xs">열기</a>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이번 주 일일보고 감정 요약 */}
        {dailySummary.length > 0 && (
          <div className="card mb-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-notion-gray font-medium">이번 주 일일보고:</span>
            {dailySummary.sort((a, b) => a.date.localeCompare(b.date)).map(r => (
              <div key={r.date} className="flex items-center gap-1 bg-notion-gray-bg rounded px-2 py-1">
                <span>{r.emotion || '📝'}</span>
                <span className="text-xs text-notion-gray">{r.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 탭 */}
        <div className="flex border-b border-notion-border mb-5">
          {(['edit', 'preview'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-notion-blue text-notion-blue' : 'border-transparent text-notion-gray hover:text-notion-text'}`}>
              {tab === 'edit' ? '✏️ 작성' : '👁 미리보기'}
            </button>
          ))}
        </div>

        {/* 관리자 블러 안내 */}
        {isAdmin && (
          <div className="mb-4 p-3 rounded-md text-sm bg-yellow-50 text-yellow-800 border border-yellow-200">
            관리자 계정은 보고 내용을 열람할 수 없습니다. 내용은 보안을 위해 블러 처리됩니다.
          </div>
        )}

        {loading && <p className="text-sm text-notion-gray text-center py-8">로딩 중...</p>}

        {!loading && activeTab === 'edit' && (
          <div className={`space-y-4${isAdmin ? ' blur-sm select-none pointer-events-none' : ''}`}>
            {/* Section 1 */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-notion-text">1. {teamName} 주요 업무 진행 상황</h2>
                <button onClick={addS1} className="text-xs text-notion-blue hover:underline">+ 항목 추가</button>
              </div>
              <div className="space-y-2">
                {draft.section1.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item.projectName} onChange={e => updateS1(i, 'projectName', e.target.value)} placeholder="프로젝트/업무명" className="input-field w-36 flex-shrink-0 text-sm" />
                    <input value={item.content} onChange={e => updateS1(i, 'content', e.target.value)} placeholder="세부 내용" className="input-field flex-1 text-sm" />
                    {draft.section1.length > 1 && <button onClick={() => removeS1(i)} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1">×</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2 */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-notion-text">2. 주요 성과</h2>
                <button onClick={addS2} className="text-xs text-notion-blue hover:underline">+ 항목 추가</button>
              </div>
              <div className="space-y-2">
                {draft.section2.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={item.achievementType} onChange={e => updateS2(i, 'achievementType', e.target.value)} className="input-field w-36 flex-shrink-0 text-sm">
                      {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={item.content} onChange={e => updateS2(i, 'content', e.target.value)} placeholder="내용" className="input-field flex-1 text-sm" />
                    {draft.section2.length > 1 && <button onClick={() => removeS2(i)} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1">×</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3 */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-notion-text">3. 고객사 지원 주요 내역</h2>
                <button onClick={addS3} className="text-xs text-notion-blue hover:underline">+ 항목 추가</button>
              </div>
              <div className="space-y-2">
                {draft.section3.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item.customerName} onChange={e => updateS3(i, 'customerName', e.target.value)} placeholder="고객사명" className="input-field w-28 flex-shrink-0 text-sm" />
                    <select
                      value={item.supportType}
                      onChange={e => updateS3(i, 'supportType', e.target.value)}
                      className={`input-field w-28 flex-shrink-0 text-sm ${!item.supportType ? 'border-red-400 text-red-500' : ''}`}
                    >
                      <option value="">지원 종류 *</option>
                      {legends.map(l => <option key={l.id} value={l.label}>{l.label}</option>)}
                    </select>
                    <input value={item.content} onChange={e => updateS3(i, 'content', e.target.value)} placeholder="지원 내용" className="input-field flex-1 text-sm" />
                    {draft.section3.length > 1 && <button onClick={() => removeS3(i)} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1">×</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4 */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-notion-text">4. 예정된 작업</h2>
                <button onClick={addS4} className="text-xs text-notion-blue hover:underline">+ 항목 추가</button>
              </div>
              <div className="space-y-2">
                {draft.section4.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item} onChange={e => updateS4(i, e.target.value)} placeholder="예정 작업 내용" className="input-field flex-1 text-sm" />
                    {draft.section4.length > 1 && <button onClick={() => removeS4(i)} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1">×</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5 */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-notion-text">5. DEQ 진행 상황</h2>
                <button onClick={addS5} className="text-xs text-notion-blue hover:underline">+ 항목 추가</button>
              </div>
              <div className="space-y-2">
                {draft.section5.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item.description} onChange={e => updateS5(i, 'description', e.target.value)} placeholder="내용을 입력하세요" className="input-field flex-1 text-sm" />
                    <input value={item.link} onChange={e => updateS5(i, 'link', e.target.value)} placeholder="링크 (선택)" className="input-field w-40 text-sm" />
                    {draft.section5.length > 1 && <button onClick={() => removeS5(i)} className="text-red-400 hover:text-red-600 text-lg leading-none mt-1">×</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 6 */}
            <div className="card">
              <h2 className="text-sm font-semibold text-notion-text mb-3">6. 팀에 대한 의견</h2>
              {autoSection6 && (
                <details className="mb-3">
                  <summary className="text-xs text-notion-blue cursor-pointer hover:underline">이번 주 하루 느낀점 참고 보기 (클릭)</summary>
                  <div className="mt-2 p-2 bg-notion-gray-bg rounded text-xs text-notion-gray whitespace-pre-line">
                    {autoSection6}
                  </div>
                </details>
              )}
              <textarea
                value={draft.section6}
                onChange={e => setDraft(d => ({ ...d, section6: e.target.value }))}
                rows={4}
                className="input-field resize-none text-sm"
                placeholder="팀이나 본부에 대한 건의사항을 자유롭게 작성하세요."
              />
            </div>
          </div>
        )}

        {/* 과거 주간보고 목록 */}
        {weeklyList.length > 0 && (
          <div className={`mt-8${isAdmin ? ' blur-sm select-none pointer-events-none' : ''}`}>
            <h2 className="text-sm font-semibold text-notion-text mb-3">과거 주간보고</h2>
            <div className="space-y-2">
              {weeklyList.map(item => {
                const isActive = item.weekStart === weekStart
                return (
                  <div
                    key={item.weekStart}
                    className={`card flex items-center justify-between py-3 transition-colors ${
                      isActive ? 'border-notion-blue bg-notion-blue-bg' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleSelectWeek(item.weekStart)}
                      className="flex-1 text-left"
                    >
                      <p className={`text-sm font-medium ${isActive ? 'text-notion-blue' : 'text-notion-text'}`}>
                        {item.weekStart} ~ {item.weekEnd}
                      </p>
                      <p className="text-xs text-notion-gray mt-0.5">
                        {isActive ? '현재 보는 주' : `저장됨: ${item.updatedAt.slice(0, 10)}`}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                      {isActive && <span className="text-xs text-notion-blue font-medium">선택됨</span>}
                      <button
                        onClick={() => handleDeleteWeek(item.weekStart)}
                        disabled={deletingWeek === item.weekStart}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                      >
                        {deletingWeek === item.weekStart ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 미리보기 */}
        {!loading && activeTab === 'preview' && (
          <div className={`bg-white border border-notion-border rounded-lg px-8 py-6${isAdmin ? ' blur-sm select-none pointer-events-none' : ''}`}>
            <div className="text-xs text-notion-gray bg-notion-gray-bg inline-block px-2 py-1 rounded mb-4">목차</div>

            <details open>
              <summary className="text-xl font-bold text-notion-text cursor-pointer list-none flex items-center gap-2 mb-4">
                <span className="text-sm text-notion-gray">▶</span>
                {divisionName} &gt; {teamName} &gt; {selectedMember}
              </summary>
              <div className="space-y-5 pl-4">
                {/* S1 */}
                <div>
                  <h2 className="text-base font-semibold border-b border-notion-border pb-1 mb-2">1. {teamName} 주요 업무 진행 상황</h2>
                  {draft.section1.filter(x => x.projectName).length === 0
                    ? <p className="text-sm text-notion-gray ml-3">• 없음</p>
                    : draft.section1.filter(x => x.projectName).map((item, i) => (
                        <div key={i} className="ml-3 mb-1">
                          <p className="text-sm">• <strong>{item.projectName}</strong></p>
                          {item.content && (
                            <details className="ml-5"><summary className="text-sm text-notion-gray cursor-pointer list-none flex items-center gap-1"><span className="text-xs">▶</span>{item.content}</summary></details>
                          )}
                        </div>
                      ))}
                </div>
                {/* S2 */}
                <div>
                  <h2 className="text-base font-semibold border-b border-notion-border pb-1 mb-2">2. 주요 성과</h2>
                  {draft.section2.filter(x => x.content).length === 0
                    ? <p className="text-sm text-notion-gray ml-3">• 없음</p>
                    : draft.section2.filter(x => x.content).map((item, i) => (
                        <div key={i} className="ml-3 mb-1">
                          <p className="text-sm font-medium">• {item.achievementType}</p>
                          <p className="text-sm ml-4">• {item.content}</p>
                        </div>
                      ))}
                </div>
                {/* S3 */}
                <div>
                  <h2 className="text-base font-semibold border-b border-notion-border pb-1 mb-2">3. 고객사 지원 주요 내역</h2>
                  {draft.section3.filter(x => x.customerName).length === 0
                    ? <p className="text-sm text-notion-gray ml-3">• 없음</p>
                    : (() => {
                        const map = new Map<string, Map<string, string[]>>()
                        draft.section3.filter(x => x.customerName).forEach(item => {
                          if (!map.has(item.customerName)) map.set(item.customerName, new Map())
                          const st = item.supportType || '기타'
                          if (!map.get(item.customerName)!.has(st)) map.get(item.customerName)!.set(st, [])
                          if (item.content) map.get(item.customerName)!.get(st)!.push(item.content)
                        })
                        return Array.from(map.entries()).map(([customer, supports]) => (
                          <div key={customer} className="ml-3 mb-2">
                            <p className="text-sm font-medium">• {customer}</p>
                            {Array.from(supports.entries()).map(([type, items]) => (
                              <details key={type} className="ml-5 mb-1">
                                <summary className="text-sm cursor-pointer list-none flex items-center gap-1"><span className="text-xs text-notion-gray">▶</span>{type}</summary>
                                <div className="ml-4">{items.map((c, i) => <p key={i} className="text-sm">• {c}</p>)}</div>
                              </details>
                            ))}
                          </div>
                        ))
                      })()}
                </div>
                {/* S4 */}
                <div>
                  <h2 className="text-base font-semibold border-b border-notion-border pb-1 mb-2">4. 예정된 작업</h2>
                  {draft.section4.filter(Boolean).length === 0
                    ? <p className="text-sm text-notion-gray ml-3">• 없음</p>
                    : draft.section4.filter(Boolean).map((item, i) => <p key={i} className="text-sm ml-3">• {item}</p>)}
                </div>
                {/* S5 */}
                <div>
                  <h2 className="text-base font-semibold border-b border-notion-border pb-1 mb-2">5. DEQ 진행 상황</h2>
                  {draft.section5.filter(x => x.description).length === 0
                    ? <p className="text-sm text-notion-gray ml-3">• 없음</p>
                    : draft.section5.filter(x => x.description).map((item, i) => (
                        <div key={i} className="ml-3 mb-1">
                          <p className="text-sm">• {item.description}
                            {item.link && <a href={item.link.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-notion-blue underline text-xs">{item.link}</a>}
                          </p>
                        </div>
                      ))}
                </div>
                {/* S6 */}
                <div>
                  <h2 className="text-base font-semibold border-b border-notion-border pb-1 mb-2">6. 팀에 대한 의견</h2>
                  {draft.section6
                    ? <p className="text-sm ml-3 whitespace-pre-line">{draft.section6}</p>
                    : <p className="text-sm text-notion-gray ml-3">• (없음)</p>}
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
