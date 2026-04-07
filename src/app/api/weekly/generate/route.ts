import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getMembers } from '@/lib/db'
import { exportWeeklyToNotion } from '@/lib/notion'
import type { WeeklyDraft } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'test') return NextResponse.json({ error: 'test 계정은 Notion 내보내기를 사용할 수 없습니다.' }, { status: 403 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const members = await getMembers()
  const member = members.find(m => m.name === session.name)
  if (!member) return NextResponse.json({ error: '팀원 정보 없음' }, { status: 404 })

  const draft = await request.json() as WeeklyDraft
  draft.authorName = session.name

  try {
    const pageId = await exportWeeklyToNotion(draft, settings, member)
    return NextResponse.json({ success: true, pageId })
  } catch (e: any) {
    const msg = e?.message || 'Notion 내보내기에 실패했습니다.'
    console.error('[weekly/generate] Notion export error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
