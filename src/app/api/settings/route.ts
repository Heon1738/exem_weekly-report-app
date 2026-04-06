import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings } from '@/lib/notion'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  // DB ID는 팀장에게만 노출
  if (session.role !== 'leader') {
    return NextResponse.json({ teamName: settings.teamName, divisionName: settings.divisionName })
  }

  return NextResponse.json(settings)
}
