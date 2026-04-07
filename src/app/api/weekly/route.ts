import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, loadWeeklyDraft, saveWeeklyDraft } from '@/lib/db'
import type { WeeklyDraft } from '@/types'

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]
  return { weekStart: fmt(mon), weekEnd: fmt(fri) }
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const targetName = searchParams.get('name')
  const authorName = (session.role === 'leader' || session.role === 'admin') && targetName ? targetName : session.name
  const { weekStart, weekEnd } = getWeekRange(date)

  const existing = await loadWeeklyDraft(weekStart, weekEnd, authorName)

  const dailyReports = await getDailyReports(authorName, weekStart, weekEnd)
  const autoSection6 = dailyReports
    .filter(r => r.dailyFeeling)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => `[${r.date}] ${r.dailyFeeling}`)
    .join('\n')

  if (existing) {
    return NextResponse.json({
      ...existing,
      autoSection6,
      dailyReports: dailyReports.map(r => ({ id: r.id, date: r.date, emotion: r.emotion, dailyFeeling: r.dailyFeeling })),
    })
  }

  const emptyDraft: WeeklyDraft = {
    weekStart, weekEnd, authorName,
    section1: [{ projectName: '', content: '' }],
    section2: [{ achievementType: '컨설팅', content: '' }],
    section3: [{ customerName: '', supportType: '', content: '' }],
    section4: [''],
    section5: [{ description: '', link: '' }],
    section6: '',
    mappedDates: dailyReports.map(r => r.date),
  }

  return NextResponse.json({
    ...emptyDraft,
    autoSection6,
    dailyReports: dailyReports.map(r => ({ id: r.id, date: r.date, emotion: r.emotion, dailyFeeling: r.dailyFeeling })),
  })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'test') return NextResponse.json({ error: 'test 계정은 저장할 수 없습니다.' }, { status: 403 })

  const draft = await request.json() as WeeklyDraft
  draft.authorName = session.name

  const id = await saveWeeklyDraft(draft)
  return NextResponse.json({ success: true, id })
}
