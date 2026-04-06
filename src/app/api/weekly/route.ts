import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getWeekRange } from '@/lib/weekly-generator'
import { Client } from '@notionhq/client'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const targetName = searchParams.get('name')

  const { weekStart, weekEnd } = getWeekRange(new Date(date))
  const authorName = session.role === 'leader' && targetName ? targetName : session.name

  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN })
    const weeklyDb = process.env.NOTION_WEEKLY_DB_ID!

    const res = await notion.databases.query({
      database_id: weeklyDb,
      filter: {
        and: [
          { property: '작성자', rich_text: { equals: authorName } },
          { property: '보고 기간', date: { on_or_after: weekStart } },
          { property: '보고 기간', date: { on_or_before: weekEnd } },
        ],
      },
    })

    if (res.results.length === 0) {
      return NextResponse.json({ exists: false, weekStart, weekEnd })
    }

    const page = res.results[0] as any
    return NextResponse.json({
      exists: true,
      pageId: page.id,
      title: page.properties['주간보고서 (클릭)']?.title?.[0]?.plain_text ?? '',
      weekStart: page.properties['보고 기간']?.date?.start ?? weekStart,
      weekEnd: page.properties['보고 기간']?.date?.end ?? weekEnd,
      authorName: page.properties['작성자']?.rich_text?.[0]?.plain_text ?? '',
      createdDate: page.properties['작성 일자']?.date?.start ?? '',
      url: page.public_url ?? page.url,
    })
  } catch (error) {
    return NextResponse.json({ error: '주간보고 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
