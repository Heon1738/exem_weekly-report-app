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

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY가 설정되지 않았습니다.')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Groq API 오류 (${res.status}): ${err}`) }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
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

  const sorted = dailyReports.sort((a, b) => a.date.localeCompare(b.date))

  // Section 3: 고객사 지원 - 일일보고 고객사명 기반으로 직접 생성 (AI 불필요)
  const customerMap = new Map<string, string[]>()
  for (const r of sorted) {
    if (r.customerName) {
      if (!customerMap.has(r.customerName)) customerMap.set(r.customerName, [])
      if (r.memorableEvent) customerMap.get(r.customerName)!.push(r.memorableEvent)
    }
  }
  const section3 = customerMap.size > 0
    ? Array.from(customerMap.entries()).map(([customerName, contents]) => ({
        customerName,
        supportType: '',
        content: contents.join(' / '),
      }))
    : [{ customerName: '', supportType: '', content: '' }]

  // Section 4: 예정 작업 - 일일보고 느낀점에서 예정/계획 내용 AI로 추출
  let section4: string[] = ['']
  const allFeelings = sorted.filter(r => r.dailyFeeling).map(r => `[${r.date}] ${r.dailyFeeling}`).join('\n')
  if (allFeelings) {
    try {
      const prompt = `아래 직장인의 일일보고 느낀점에서 앞으로 예정된 작업이나 계획된 내용만 추출하세요.
없으면 빈 배열을 반환하세요. JSON만 반환하고 다른 텍스트는 없어야 합니다.

일일보고:
${allFeelings}

반환 형식: {"section4":["예정 작업1","예정 작업2"]} 또는 {"section4":[]}`
      const text = await callGroq(prompt)
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed.section4) && parsed.section4.length > 0) {
          section4 = parsed.section4
        }
      }
    } catch {}
  }

  const members = await getMembers(settings.membersDbId)
  const member = members.find(m => m.name === session.name)
  if (!member) return NextResponse.json({ error: '팀원 정보 없음' }, { status: 404 })

  const draft: WeeklyDraft = {
    weekStart,
    weekEnd,
    authorName: session.name,
    section1: [{ projectName: '', content: '' }],
    section2: [{ achievementType: '컨설팅', content: '' }],
    section3,
    section4,
    section5: [{ description: '', link: '' }],
    section6: '',
    mappedDates: dailyReports.map(r => r.date),
  }

  await saveWeeklyDraft(draft, member)
  return NextResponse.json({ success: true, weekStart, weekEnd })
}
