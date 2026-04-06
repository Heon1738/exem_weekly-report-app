'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload, DailyReport } from '@/types'
import { EMOTION_OPTIONS, autoFillFromFeeling } from '@/types'

interface Props { session: JwtPayload }

const emptyForm = (name: string): DailyReport => ({
  date: new Date().toISOString().split('T')[0],
  authorName: name,
  emotion: '',
  memorableEvent: '',
  hardThing: '',
  dailyFeeling: '',
})

export default function DailyReportClient({ session }: Props) {
  const [form, setForm] = useState<DailyReport>(emptyForm(session.name))
  const [editingId, setEditingId] = useState<string | null>(null)  // null = 새 작성
  const [recentReports, setRecentReports] = useState<DailyReport[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { fetchRecentReports() }, [])

  const fetchRecentReports = async () => {
    try {
      const res = await fetch('/api/daily')
      if (res.ok) setRecentReports(await res.json())
    } catch {}
  }

  const handleAutoFill = () => {
    if (!form.dailyFeeling.trim()) {
      setMessage({ type: 'error', text: '먼저 하루 느낀점을 입력해주세요.' })
      return
    }
    const filled = autoFillFromFeeling(form.dailyFeeling)
    setForm(f => ({ ...f, ...filled }))
    setMessage({ type: 'success', text: '자동 채우기 완료! 내용을 확인하고 수정해주세요.' })
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
        // 수정
        res = await fetch(`/api/daily/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        // 신규 저장
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
                className="text-xs bg-notion-blue text-white px-2.5 py-1 rounded-md hover:bg-blue-600 transition-colors"
              >
                ✨ 자동 채우기
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

        {/* 최근 일일보고 목록 */}
        <div className="mt-10">
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
                      <p className="text-sm font-medium text-notion-text">{r.date}</p>
                      <p className="text-xs text-notion-gray line-clamp-1 max-w-xs">
                        {r.dailyFeeling || '(내용 없음)'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(r)}
                    disabled={!!editingId && editingId !== r.id}
                    className="text-xs text-notion-blue hover:underline disabled:opacity-40"
                  >
                    {editingId === r.id ? '수정 중...' : '수정'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
