import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getMembers, loadWeeklyDraft } from '@/lib/db'
import { exportAllMembersWeeklyToNotion } from '@/lib/notion'
import type { WeeklyDraft } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { weekStart, weekEnd } = await request.json()
  if (!weekStart || !weekEnd) return NextResponse.json({ error: 'weekStart, weekEnd 필요' }, { status: 400 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const members = await getMembers()

  // Load each member's weekly draft
  const draftsMap = new Map<string, WeeklyDraft>()
  for (const member of members) {
    const draft = await loadWeeklyDraft(weekStart, weekEnd, member.name)
    if (draft) draftsMap.set(member.name, draft)
  }

  const results = await exportAllMembersWeeklyToNotion(weekStart, members, draftsMap, settings)
  return NextResponse.json({ success: true, results })
}
