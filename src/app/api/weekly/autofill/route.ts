import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, saveWeeklyDraft, getMembers } from '@/lib/notion'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WeeklyDraft } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + diff)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const fmt = (dt: Date) => dt.toISOString().split('T')[0]
  return { weekStart: fmt(mon), weekEnd: fmt(fri) }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const { date } = await request.json().catch(() => ({}))
  const targetDate = date || new Date().toISOString().split('T')[0]
  const { weekStart, weekEnd } = getWeekRange(targetDate)

  // 이번 주 일일보고 조회
  const dailyReports = await getDailyReports(settings.dailyDbId, session.name, weekStart, weekEnd)

  if (dailyReports.length === 0) {
    return NextResponse.json({ error: '이번 주 작성된 일일보고가 없습니다.' }, { status: 400 })
  }

  // 일일보고 데이터 정리
  const reportData = dailyReports
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      날짜: r.date,
      기억에남는일: r.memorableEvent || '',
      힘들었던점: r.hardThing || '',
      하루느낀점: r.dailyFeeling || '',
    }))

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `당신은 직장인의 일일보고를 주간보고로 요약하는 전문가입니다.
아래는 이번 주(${weekStart} ~ ${weekEnd}) 일일보고 데이터입니다.

${JSON.stringify(reportData, null, 2)}

이 데이터를 분석하여 주간보고 JSON을 생성하세요. 다른 텍스트 없이 순수 JSON만 반환하세요.

JSON 형식:
{
  "section1": [{"projectName": "프로젝트/업무명", "content": "진행 내용 요약"}],
  "section2": [{"achievementType": "컨설팅", "content": "성과 내용"}],
  "section4": ["특이사항1", "특이사항2"],
  "section6": "이번 주 전반적인 소감 (팀에 대한 의견)"
}

작성 규칙:
- section1: 기억에남는일을 분석해 주요 업무/프로젝트 항목으로 정리 (최대 3개, 비슷한 내용은 묶기)
- section2.achievementType: "컨설팅", "PreSales", "PoC", "장애분석", "기술문서 공유" 중 하나 선택
- section2: 기억에남는일 중 성과/완료된 내용 (최대 2개)
- section4: 힘들었던점에서 특이하거나 주목할 내용 (없으면 빈 배열 [])
- section6: 하루느낀점들을 종합한 이번 주 소감 (2~3문장)
- 내용이 없거나 불명확하면 해당 항목을 최소화 (빈 배열 또는 짧은 내용)
- 모든 내용은 한국어로 작성`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    })

    const text = result.response.text().trim()
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text
    const generated = JSON.parse(jsonStr)

    // 멤버 정보 조회
    const members = await getMembers(settings.membersDbId)
    const member = members.find(m => m.name === session.name)
    if (!member) return NextResponse.json({ error: '팀원 정보 없음' }, { status: 404 })

    // 주간보고 초안 구성
    const draft: WeeklyDraft = {
      weekStart,
      weekEnd,
      authorName: session.name,
      section1: generated.section1?.length > 0
        ? generated.section1
        : [{ projectName: '', content: '' }],
      section2: generated.section2?.length > 0
        ? generated.section2
        : [{ achievementType: '컨설팅', content: '' }],
      section3: [{ customerName: '', supportType: '', content: '' }],
      section4: generated.section4?.length > 0 ? generated.section4 : [''],
      section5: { longPending: 0, urgent: 0 },
      section6: generated.section6 || '',
      mappedDates: dailyReports.map(r => r.date),
    }

    // 초안 저장
    await saveWeeklyDraft(draft, member)

    return NextResponse.json({ success: true, weekStart, weekEnd, draft })
  } catch (e: any) {
    if (e?.status === 429) {
      return NextResponse.json({ error: 'AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }
    console.error('Weekly autofill error:', e)
    return NextResponse.json({ error: '주간보고 자동생성에 실패했습니다.' }, { status: 500 })
  }
}
