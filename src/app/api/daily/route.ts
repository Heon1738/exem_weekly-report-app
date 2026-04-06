import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, createDailyReport } from '@/lib/notion'
import type { DailyReport } from '@/types'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart') || undefined
  const weekEnd = searchParams.get('weekEnd') || undefined
  const targetName = searchParams.get('name')
  const authorName = session.role === 'leader' && targetName ? targetName : session.name

  const reports = await getDailyReports(settings.dailyDbId, authorName, weekStart, weekEnd)
  return NextResponse.json(reports)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const body = await request.json() as DailyReport
  body.authorName = session.name

  const id = await createDailyReport(settings.dailyDbId, body)
  return NextResponse.json({ success: true, id })
}
