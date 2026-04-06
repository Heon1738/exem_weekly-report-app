import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, saveWeeklyDraft, getMembers } from '@/lib/notion'
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

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API 오류 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const targetDate = body.date || new Date().toISOString().split('T')[0]
  const { weekStart, weekEnd } = getWeekRange(targetDate)

  const dailyReports = await getDailyReports(settings.dailyDbId, session.name, weekStart, weekEnd)
  if (dailyReports.length === 0) {
    return NextResponse.json({ error: '이번 주 작성된 일일보고가 없습니다.' }, { status: 400 })
  }

  const reportLines = dailyReports
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => `[${r.date}] 기억에남는일: ${r.memorableEvent || '없음'} / 힘들었던점: ${r.hardThing || '없음'} / 느낀점: ${r.dailyFeeling || '없음'}`)
    .join('\n')

  const prompt = `직장인의 이번 주(${weekStart}~${weekEnd}) 일일보고를 주간보고 JSON으로 요약하세요.
JSON 외 다른 텍스트는 절대 출력하지 마세요. 마크다운 코드블록도 사용하지 마세요.

일일보고 내용:
${reportLines}

반환할 JSON (정확히 이 형식):
{"section1":[{"projectName":"업무명","content":"진행내용"}],"section2":[{"achievementType":"컨설팅","content":"성과내용"}],"section4":["특이사항"],"section6":"주간소감"}

규칙:
- section1: 기억에남는일에서 주요 업무 추출, 비슷한 내용 묶어서 최대 3개
- section2.achievementType: 반드시 "컨설팅","PreSales","PoC","장애분석","기술문서 공유" 중 하나
- section2: 완료/성과 내용, 최대 2개
- section4: 힘들었던점 중 특이사항, 없으면 빈 배열 []
- section6: 느낀점을 종합한 2~3문장 소감
- 모든 내용은 한국어`

  try {
    const text = await callGemini(prompt)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON을 찾을 수 없습니다: ' + text.slice(0, 200))

    const generated = JSON.parse(jsonMatch[0])

    const members = await getMembers(settings.membersDbId)
    const member = members.find(m => m.name === session.name)
    if (!member) return NextResponse.json({ error: '팀원 정보 없음' }, { status: 404 })

    const draft: WeeklyDraft = {
      weekStart,
      weekEnd,
      authorName: session.name,
      section1: Array.isArray(generated.section1) && generated.section1.length > 0
        ? generated.section1
        : [{ projectName: '', content: '' }],
      section2: Array.isArray(generated.section2) && generated.section2.length > 0
        ? generated.section2
        : [{ achievementType: '컨설팅', content: '' }],
      section3: [{ customerName: '', supportType: '', content: '' }],
      section4: Array.isArray(generated.section4) && generated.section4.length > 0
        ? generated.section4
        : [''],
      section5: { longPending: 0, urgent: 0 },
      section6: generated.section6 || '',
      mappedDates: dailyReports.map(r => r.date),
    }

    await saveWeeklyDraft(draft, member)

    return NextResponse.json({ success: true, weekStart, weekEnd })
  } catch (e: any) {
    console.error('[weekly/autofill] error:', e?.message)
    return NextResponse.json(
      { error: e?.message?.includes('GEMINI_API_KEY') ? 'Gemini API 키가 설정되지 않았습니다.' : '주간보고 자동생성에 실패했습니다: ' + (e?.message ?? '') },
      { status: 500 }
    )
  }
}
