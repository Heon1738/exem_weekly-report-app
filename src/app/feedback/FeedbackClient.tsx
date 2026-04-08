'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import type { JwtPayload } from '@/types'

interface FeedbackItem {
  id: string
  authorName: string
  content: string
  isRead: boolean
  createdAt: string
}

interface Props { session: JwtPayload }

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function FeedbackClient({ session }: Props) {
  const isAdmin = session.role === 'admin'
  const isTest = session.role === 'test'

  // 제출 폼
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // admin 목록
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [listLoading, setListLoading] = useState(false)

  useEffect(() => {
    if (isAdmin) loadList()
  }, [])

  const loadList = async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/feedback')
      if (res.ok) setFeedbackList(await res.json())
    } catch {}
    setListLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setSubmitMsg({ type: 'success', text: '제출되었습니다. 소중한 의견 감사합니다!' })
        setContent('')
      } else {
        const data = await res.json()
        setSubmitMsg({ type: 'error', text: data.error || '제출에 실패했습니다.' })
      }
    } catch {
      setSubmitMsg({ type: 'error', text: '오류가 발생했습니다.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-notion-sidebar">
      <Navbar userName={session.name} role={session.role} />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-notion-text">개선 요청</h1>
          <p className="text-sm text-notion-gray mt-1">
            {isAdmin
              ? '팀원들이 제출한 불편 사항 및 개선 요청 내역입니다.'
              : '불편한 점이나 개선이 필요한 사항을 자유롭게 작성해주세요.'}
          </p>
        </div>

        {/* 제출 폼 — admin도 제출 가능, test는 불가 */}
        {!isTest && (
          <div className="card mb-6">
            <h2 className="text-sm font-semibold text-notion-text mb-3">
              {isAdmin ? '관리자 메모 추가' : '의견 작성'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                className="input-field resize-none"
                placeholder="불편한 점, 개선이 필요한 기능, 버그 등을 자유롭게 작성해주세요."
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-notion-gray">{content.length} / 1000</span>
                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '제출 중...' : '제출'}
                </button>
              </div>
              {submitMsg && (
                <p className={`text-sm ${submitMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {submitMsg.text}
                </p>
              )}
            </form>
          </div>
        )}

        {isTest && (
          <div className="card mb-6">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              테스트 계정은 의견을 제출할 수 없습니다.
            </p>
          </div>
        )}

        {/* admin 전용 목록 */}
        {isAdmin && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-notion-text">
                접수된 의견 {feedbackList.length > 0 && `(총 ${feedbackList.length}건)`}
              </h2>
              <button onClick={loadList} className="text-xs text-notion-blue hover:underline">
                새로고침
              </button>
            </div>

            {listLoading ? (
              <p className="text-sm text-notion-gray">불러오는 중...</p>
            ) : feedbackList.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm text-notion-gray">아직 접수된 의견이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackList.map(item => (
                  <div
                    key={item.id}
                    className={`card border-l-4 ${item.isRead ? 'border-l-notion-border' : 'border-l-notion-blue'}`}
                  >
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-notion-text">{item.authorName}</span>
                        {!item.isRead && (
                          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">NEW</span>
                        )}
                      </div>
                      <span className="text-xs text-notion-gray">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="text-sm text-notion-text whitespace-pre-wrap leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
