import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getMembers, exportWeeklyToNotion, loadWeeklyDraft } from '@/lib/notion'
import type { WeeklyDraft } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const members = await getMembers(settings.membersDbId)
  const member = members.find(m => m.name === session.name)
  if (!member) return NextResponse.json({ error: '팀원 정보 없음' }, { status: 404 })

  const draft = await request.json() as WeeklyDraft
  draft.authorName = session.name

  const pageId = await exportWeeklyToNotion(draft, settings, member)

  return NextResponse.json({ success: true, pageId })
}
