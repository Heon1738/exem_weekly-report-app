import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, exportWeeklyReportToNotion, getMappedDatesFromWeeklyPage, getMembers } from '@/lib/notion'
import { generateWeeklyReport, getWeekRange } from '@/lib/weekly-generator'

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const { date } = await request.json()
  const baseDate = date ? new Date(date) : new Date()
  const { weekStart, weekEnd } = getWeekRange(baseDate)

  // 해당 주의 일일보고 조회
  const dailyReports = await getDailyReports(settings.dailyDbId, session.name, weekStart, weekEnd)

  if (dailyReports.length === 0) {
    return NextResponse.json({ error: '해당 주의 일일보고가 없습니다.' }, { status: 400 })
  }

  // 기존 주간보고에서 이미 매핑된 날짜 확인
  const members = await getMembers(settings.membersDbId)
  const member = members.find(m => m.name === session.name)
  if (!member) return NextResponse.json({ error: '팀원 정보를 찾을 수 없습니다.' }, { status: 404 })

  // 기존 주간보고 페이지에서 매핑된 날짜 읽기
  let existingMappedDates: string[] = []
  let existingPageId: string | null = null

  try {
    const { Client } = await import('@notionhq/client')
    const notion = new Client({ auth: process.env.NOTION_TOKEN })
    const weeklyDb = process.env.NOTION_WEEKLY_DB_ID!

    const res = await notion.databases.query({
      database_id: weeklyDb,
      filter: {
        and: [
          { property: '작성자', rich_text: { equals: session.name } },
          { property: '보고 기간', date: { on_or_after: weekStart } },
          { property: '보고 기간', date: { on_or_before: weekEnd } },
        ],
      },
    })

    if (res.results.length > 0) {
      existingPageId = res.results[0].id
      existingMappedDates = await getMappedDatesFromWeeklyPage(existingPageId)
    }
  } catch {}

  // 주간보고 데이터 생성
  const weeklyReport = generateWeeklyReport(dailyReports, existingMappedDates, session.name)

  // 새로 추가할 날짜가 없는 경우
  const newDates = dailyReports
    .map(r => r.date)
    .filter(d => !existingMappedDates.includes(d))

  if (newDates.length === 0) {
    return NextResponse.json({
      message: '모든 일일보고가 이미 주간보고에 반영되어 있습니다.',
      weekStart, weekEnd,
      mappedDates: existingMappedDates,
    })
  }

  // Notion 주간보고 페이지 생성/업데이트
  const pageId = await exportWeeklyReportToNotion(weeklyReport, settings, member)

  return NextResponse.json({
    success: true,
    pageId,
    title: weeklyReport.title,
    weekStart,
    weekEnd,
    newDates,
    mappedDates: weeklyReport.mappedDates,
  })
}
