import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getDailyReports, createDailyReport } from '@/lib/db'
import type { DailyReport } from '@/types'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart') || undefined
  const weekEnd = searchParams.get('weekEnd') || undefined
  const targetName = searchParams.get('name')
  const authorName = (session.role === 'leader' || session.role === 'admin') && targetName ? targetName : session.name

  const reports = await getDailyReports(authorName, weekStart, weekEnd)
  return NextResponse.json(reports)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'test') return NextResponse.json({ error: 'test 계정은 저장할 수 없습니다.' }, { status: 403 })

  const body = await request.json() as DailyReport
  body.authorName = session.name

  const id = await createDailyReport(body)
  return NextResponse.json({ success: true, id })
}
