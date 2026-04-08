import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getPatchNotes, upsertPatchNote, deletePatchNote } from '@/lib/db'

// GET — 로그인 사용자 전체 조회 (admin 페이지용)
export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const notes = await getPatchNotes()
  return NextResponse.json(notes)
}

// POST — admin: 패치노트 추가/수정
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { date, items } = await request.json()
  if (!date || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '날짜와 항목을 입력해주세요.' }, { status: 400 })
  }
  const filtered = items.map((s: string) => s.trim()).filter(Boolean)
  if (!filtered.length) return NextResponse.json({ error: '유효한 항목이 없습니다.' }, { status: 400 })
  const id = await upsertPatchNote(date, filtered)
  return NextResponse.json({ success: true, id })
}

// DELETE — admin: 패치노트 삭제
export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
  await deletePatchNote(id)
  return NextResponse.json({ success: true })
}
