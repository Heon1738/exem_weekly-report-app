import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getDailyReports, saveWeeklyDraft, getMembers } from '@/lib/db'
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
      temperature: 0.1,
    }),
  })
  if (!res.ok) { const err = await res.text(); throw new Error(`Groq API 오류 (${res.status}): ${err}`) }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const targetDate = body.date || new Date().toISOString().split('T')[0]
  const { weekStart, weekEnd } = getWeekRange(targetDate)

  const dailyReports = await getDailyReports(session.name, weekStart, weekEnd)
  if (dailyReports.length === 0) {
    return NextResponse.json({ error: '이번 주 작성된 일일보고가 없습니다.' }, { status: 400 })
  }

  const sorted = dailyReports.sort((a, b) => a.date.localeCompare(b.date))

  // Section 3: 고객사별 지원 내역 — AI로 명확하고 명사형으로 생성
  interface CustomerEntry { customer: string; date: string; feeling: string }
  const rawEntries: CustomerEntry[] = []
  for (const r of sorted) {
    if (r.customerName) {
      const customers = r.customerName.split(',').map(c => c.trim()).filter(Boolean)
      for (const customer of customers) {
        rawEntries.push({ customer, date: r.date, feeling: r.dailyFeeling || r.memorableEvent || '' })
      }
    }
  }

  let section3: WeeklyDraft['section3'] = [{ customerName: '', supportType: '', content: '' }]

  if (rawEntries.length > 0) {
    try {
      const grouped = new Map<string, string[]>()
      for (const e of rawEntries) {
        if (!grouped.has(e.customer)) grouped.set(e.customer, [])
        if (e.feeling) grouped.get(e.customer)!.push(`[${e.date}] ${e.feeling}`)
      }

      const entriesText = Array.from(grouped.entries())
        .map(([customer, feelings]) => `고객사: ${customer}\n내용:\n${feelings.join('\n')}`)
        .join('\n\n---\n\n')

      const prompt = `아래 일일보고에서 각 고객사별 지원 내용을 명사형으로 간결하게 요약하세요.
JSON만 반환하세요. 마크다운 코드블록 사용 금지.

일일보고:
${entriesText}

반환 형식: {"results":[{"customer":"고객사명","content":"요약내용"},...]}

규칙:
- content는 해당 고객사와 직접 관련된 지원 작업만 포함
- 명사형 또는 명사+완료 형식으로 종결 (예: "DB 성능 점검 완료", "장애 원인 분석 및 패치 적용")
- 한국어, 구체적인 시스템명·작업명 포함
- 구어체 금지`

      const text = await callGroq(prompt)
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed.results) && parsed.results.length > 0) {
          section3 = parsed.results.map((r: any) => ({
            customerName: r.customer || '',
            supportType: '',
            content: r.content || '',
          }))
        }
      }
    } catch {
      const fallbackMap = new Map<string, string[]>()
      for (const e of rawEntries) {
        if (!fallbackMap.has(e.customer)) fallbackMap.set(e.customer, [])
        if (e.feeling) fallbackMap.get(e.customer)!.push(e.feeling)
      }
      section3 = Array.from(fallbackMap.entries()).map(([customerName, feelings]) => ({
        customerName, supportType: '', content: feelings.join(' / '),
      }))
    }
  }

  // Section 4: 예정 작업 — 명사형으로 추출
  let section4: string[] = ['']
  const allFeelings = sorted.filter(r => r.dailyFeeling).map(r => `[${r.date}] ${r.dailyFeeling}`).join('\n')
  if (allFeelings) {
    try {
      const prompt = `아래 일일보고 느낀점에서 앞으로 예정된 작업이나 계획만 추출하세요.
없으면 빈 배열을 반환하세요. JSON만 반환하세요. 마크다운 코드블록 사용 금지.

일일보고:
${allFeelings}

반환 형식: {"section4":["예정 작업1","예정 작업2"]} 또는 {"section4":[]}

규칙:
- 명사형 또는 명사+예정 형식으로 종결 (예: "A사 정기 점검 예정", "B 시스템 배포 대응")
- 구어체 금지`

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

  const draft: WeeklyDraft = {
    weekStart, weekEnd,
    authorName: session.name,
    section1: [{ projectName: '', content: '' }],
    section2: [{ achievementType: '컨설팅', content: '' }],
    section3,
    section4,
    section5: [{ description: '', link: '' }],
    section6: '',
    mappedDates: dailyReports.map(r => r.date),
  }

  await saveWeeklyDraft(draft)
  return NextResponse.json({ success: true, weekStart, weekEnd })
}
