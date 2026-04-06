import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, loadWeeklyDraft, saveWeeklyDraft, getMembers } from '@/lib/notion'
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

// GET: 주간보고 초안 로드 + 일일보고에서 팀의견 자동 집계
export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const targetName = searchParams.get('name')
  const authorName = session.role === 'leader' && targetName ? targetName : session.name
  const { weekStart, weekEnd } = getWeekRange(date)

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  // 기존 초안 로드
  const existing = await loadWeeklyDraft(weekStart, weekEnd, authorName)

  // 이번 주 일일보고에서 하루 느낀점 집계 (팀 의견용)
  const dailyReports = await getDailyReports(settings.dailyDbId, authorName, weekStart, weekEnd)
  const autoSection6 = dailyReports
    .filter(r => r.dailyFeeling)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => `[${r.date}] ${r.dailyFeeling}`)
    .join('\n')

  if (existing) {
    // 기존 초안이 있으면 팀 의견만 자동 업데이트 (이미 작성된 내용은 보존)
    return NextResponse.json({
      ...existing,
      autoSection6,  // 자동 집계된 내용 (참고용)
      dailyReports: dailyReports.map(r => ({ id: r.id, date: r.date, emotion: r.emotion, dailyFeeling: r.dailyFeeling })),
    })
  }

  // 초안이 없으면 빈 초안 반환
  const emptyDraft: WeeklyDraft = {
    weekStart, weekEnd, authorName,
    section1: [{ projectName: '', content: '' }],
    section2: [{ achievementType: '컨설팅', content: '' }],
    section3: [{ customerName: '', supportType: '', content: '' }],
    section4: [''],
    section5: { longPending: 0, urgent: 0 },
    section6: autoSection6,
    mappedDates: dailyReports.map(r => r.date),
  }

  return NextResponse.json({
    ...emptyDraft,
    autoSection6,
    dailyReports: dailyReports.map(r => ({ id: r.id, date: r.date, emotion: r.emotion, dailyFeeling: r.dailyFeeling })),
  })
}

// POST: 주간보고 초안 저장
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

  const pageId = await saveWeeklyDraft(draft, member)
  return NextResponse.json({ success: true, pageId })
}
