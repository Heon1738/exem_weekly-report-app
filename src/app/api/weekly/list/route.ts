import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getWeeklyDraftsList, deleteWeeklyDraft } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetName = searchParams.get('name')
  const authorName = session.role === 'leader' && targetName ? targetName : session.name

  const list = await getWeeklyDraftsList(authorName)
  return NextResponse.json(list)
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { weekStart, authorName: targetName } = await request.json()
  if (!weekStart) return NextResponse.json({ error: 'weekStart가 필요합니다.' }, { status: 400 })

  const authorName = session.role === 'leader' && targetName ? targetName : session.name
  await deleteWeeklyDraft(weekStart, authorName)
  return NextResponse.json({ success: true })
}
