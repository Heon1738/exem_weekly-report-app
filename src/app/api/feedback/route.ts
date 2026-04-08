import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { createFeedback, getFeedbackList, markAllFeedbackRead } from '@/lib/db'

// GET — admin 전용: 전체 목록 조회 + 전체 읽음 처리
export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const list = await getFeedbackList()
  await markAllFeedbackRead()
  return NextResponse.json(list)
}

// POST — 로그인한 모든 사용자: 제출 (test 제외)
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'test') return NextResponse.json({ error: 'test 계정은 제출할 수 없습니다.' }, { status: 403 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })

  const id = await createFeedback(session.name, content.trim())
  return NextResponse.json({ success: true, id })
}
