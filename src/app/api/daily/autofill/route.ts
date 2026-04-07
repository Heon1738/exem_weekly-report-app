import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'

const EMOTION_OPTIONS = [
  { emoji: '😊', label: '기쁨' },
  { emoji: '😄', label: '즐거움' },
  { emoji: '😐', label: '보통' },
  { emoji: '😔', label: '아쉬움' },
  { emoji: '😢', label: '슬픔' },
  { emoji: '😤', label: '답답함' },
  { emoji: '😴', label: '피곤함' },
  { emoji: '🤔', label: '고민' },
  { emoji: '💪', label: '뿌듯함' },
  { emoji: '🔥', label: '열정' },
]

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY가 설정되지 않았습니다.')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.1,
      max_tokens: 200,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API 오류 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dailyFeeling } = await request.json()
  if (!dailyFeeling?.trim()) {
    return NextResponse.json({ error: '하루 느낀점을 입력해주세요.' }, { status: 400 })
  }

  const emotionList = EMOTION_OPTIONS.map(e => `${e.emoji}(${e.label})`).join(' / ')

  const systemMessage = `당신은 IT 직장인의 하루 업무 일기에서 핵심 정보를 추출하는 분석가입니다.
반드시 순수 JSON만 출력합니다. 마크다운·코드블록·설명 텍스트는 절대 출력하지 않습니다.`

  const userMessage = `아래 [일기]를 읽고 세 가지 항목을 추출하여 JSON으로 반환하세요.

[추출 규칙]

emotion:
- 일기 전반의 지배적인 감정 1개를 이모지로 선택
- 선택지: ${emotionList}
- 성과·완료·칭찬 → 💪 또는 😊 / 막힘·답답 → 😤 / 피로 → 😴 / 고민·복잡 → 🤔 / 아쉬움·실수 → 😔 / 무난 → 😐

memorableEvent:
- 오늘 업무 중 가장 임팩트 있는 단일 사건 1가지만 추출 (전체 요약 금지)
- 완료된 지원·점검·배포·분석 등 긍정적 성과 우선
- 형식: [고객사/시스템명] [행위] [결과] — 명사형 종결
- 예시: "A사 Oracle DB 성능 점검 완료" / "B시스템 신규 배포 지원 및 정상 확인" / "C모듈 장애 원인 분석 완료"
- 구어체·주어·조사 사용 금지

hardThing:
- 어려움·문제·미해결 이슈·병목 중 가장 심각한 것 1가지만 추출
- memorableEvent와 중복 금지
- 형식: [대상] [문제 상황] — 명사형 종결
- 예시: "C모듈 응답지연 원인 미파악" / "고객사 접근 권한 미확보" / "배포 후 간헐적 오류 재현 불가"
- 해당 내용이 없으면 반드시 빈 문자열 ""
- 구어체·주어·조사 사용 금지

[일기]
${dailyFeeling}

[출력]
{"emotion":"이모지","memorableEvent":"내용","hardThing":"내용 또는 빈문자열"}`

  try {
    const text = await callGroq([
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ])
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) throw new Error('JSON을 찾을 수 없습니다.')

    const parsed = JSON.parse(jsonMatch[0])
    const validEmojis = EMOTION_OPTIONS.map(e => e.emoji)
    const emotion = validEmojis.includes(parsed.emotion) ? parsed.emotion : '😐'

    return NextResponse.json({
      emotion,
      memorableEvent: parsed.memorableEvent || '',
      hardThing: parsed.hardThing || '',
    })
  } catch (e: any) {
    console.error('[autofill] error:', e?.message)
    return NextResponse.json({ error: '자동 채우기에 실패했습니다: ' + (e?.message ?? '') }, { status: 500 })
  }
}
