'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload } from '@/types'

interface PatchNoteRow {
  id: string
  date: string
  items: string[]
}

interface Props { session: JwtPayload }

export default function PatchNotesClient({ session }: Props) {
  const [notes, setNotes] = useState<PatchNoteRow[]>([])
  const [loading, setLoading] = useState(true)

  // 새 패치노트 작성 폼
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newItems, setNewItems] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 편집
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editItems, setEditItems] = useState<string[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { loadNotes() }, [])

  const loadNotes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/patchnotes')
      if (res.ok) setNotes(await res.json())
    } catch {}
    setLoading(false)
  }

  const handleAddItem = () => setNewItems(p => [...p, ''])
  const handleRemoveItem = (i: number) => setNewItems(p => p.filter((_, idx) => idx !== i))
  const handleItemChange = (i: number, val: string) => setNewItems(p => p.map((v, idx) => idx === i ? val : v))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const filtered = newItems.map(s => s.trim()).filter(Boolean)
    if (!newDate || !filtered.length) {
      setSaveMsg({ type: 'error', text: '날짜와 항목을 입력해주세요.' }); return
    }
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/patchnotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, items: filtered }),
      })
      if (res.ok) {
        setSaveMsg({ type: 'success', text: '저장되었습니다.' })
        setNewItems([''])
        await loadNotes()
      } else {
        const d = await res.json()
        setSaveMsg({ type: 'error', text: d.error || '저장에 실패했습니다.' })
      }
    } catch { setSaveMsg({ type: 'error', text: '오류가 발생했습니다.' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 패치노트를 삭제하시겠습니까?')) return
    try {
      await fetch('/api/patchnotes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await loadNotes()
    } catch {}
  }

  const startEdit = (note: PatchNoteRow) => {
    setEditingId(note.id)
    setEditItems([...note.items])
    setEditMsg(null)
  }

  const handleEditSave = async (date: string) => {
    const filtered = editItems.map(s => s.trim()).filter(Boolean)
    if (!filtered.length) { setEditMsg({ type: 'error', text: '항목을 입력해주세요.' }); return }
    setEditSaving(true); setEditMsg(null)
    try {
      const res = await fetch('/api/patchnotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, items: filtered }),
      })
      if (res.ok) {
        setEditMsg({ type: 'success', text: '수정되었습니다.' })
        setEditingId(null)
        await loadNotes()
      } else {
        const d = await res.json()
        setEditMsg({ type: 'error', text: d.error || '수정에 실패했습니다.' })
      }
    } catch { setEditMsg({ type: 'error', text: '오류가 발생했습니다.' }) }
    finally { setEditSaving(false) }
  }

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-notion-text">패치노트 관리</h1>
          <p className="text-sm text-notion-gray mt-1">배포 후 새로운 기능/수정 사항을 추가하세요. 로그인 화면에 최신 항목이 표시됩니다.</p>
        </div>

        {/* 새 패치노트 작성 */}
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-notion-text mb-4">새 패치노트 추가</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs text-notion-gray mb-1">날짜</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="input-field w-40"
                required
              />
              <p className="text-xs text-notion-gray mt-1">같은 날짜가 이미 있으면 내용을 덮어씁니다.</p>
            </div>

            <div>
              <label className="block text-xs text-notion-gray mb-2">항목</label>
              <div className="space-y-2">
                {newItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={item}
                      onChange={e => handleItemChange(i, e.target.value)}
                      className="input-field flex-1"
                      placeholder={`항목 ${i + 1} (예: 신규 기능 추가)`}
                    />
                    {newItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(i)}
                        className="text-notion-gray hover:text-red-500 px-2 transition-colors"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-2 text-xs text-notion-blue hover:underline"
              >
                + 항목 추가
              </button>
            </div>

            {saveMsg && (
              <p className={`text-sm ${saveMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {saveMsg.text}
              </p>
            )}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? '저장 중...' : '패치노트 저장'}
            </button>
          </form>
        </div>

        {/* 기존 패치노트 목록 */}
        <div>
          <h2 className="text-sm font-semibold text-notion-text mb-3">전체 이력</h2>
          {loading ? (
            <p className="text-sm text-notion-gray">불러오는 중...</p>
          ) : notes.length === 0 ? (
            <div className="card text-center py-6">
              <p className="text-sm text-notion-gray">패치노트가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note, idx) => (
                <div key={note.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-notion-blue">{note.date}</span>
                      {idx === 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">
                          최신 · 로그인 화면 표시 중
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => editingId === note.id ? setEditingId(null) : startEdit(note)}
                        className="text-xs text-notion-blue hover:underline"
                      >
                        {editingId === note.id ? '취소' : '수정'}
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {editingId === note.id ? (
                    <div className="space-y-2">
                      {editItems.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={item}
                            onChange={e => setEditItems(p => p.map((v, idx) => idx === i ? e.target.value : v))}
                            className="input-field flex-1 text-sm"
                          />
                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setEditItems(p => p.filter((_, idx) => idx !== i))}
                              className="text-notion-gray hover:text-red-500 px-2"
                            >✕</button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditItems(p => [...p, ''])}
                        className="text-xs text-notion-blue hover:underline"
                      >+ 항목 추가</button>
                      {editMsg && (
                        <p className={`text-xs ${editMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                          {editMsg.text}
                        </p>
                      )}
                      <button
                        onClick={() => handleEditSave(note.date)}
                        disabled={editSaving}
                        className="btn-primary text-sm py-1.5"
                      >
                        {editSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {note.items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-notion-text">
                          <span className="text-notion-blue shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-notion-gray text-center mt-8">
          페이지 개설일: 2026-04-04
        </p>
      </div>
    </div>
  )
}
