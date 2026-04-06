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

async function callGroq(prompt: string): Promise<string> {
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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
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

  const emotionList = EMOTION_OPTIONS.map(e => `${e.emoji}=${e.label}`).join(', ')

  const prompt = `직장인의 하루 일기를 분석해서 JSON으로 반환하세요.
JSON 외 다른 텍스트는 절대 출력하지 마세요. 마크다운 코드블록도 사용하지 마세요.

일기: ${dailyFeeling}

반환할 JSON (정확히 이 형식):
{"emotion":"이모지","memorableEvent":"요약","hardThing":"요약"}

규칙:
- emotion: ${emotionList} 중 하나의 이모지만 선택. 전체 맥락에서 가장 지배적인 감정을 선택
- memorableEvent: 오늘 완료한 업무 또는 성과를 핵심만 담아 1문장으로 작성. 고객사명·시스템명 등 구체적 명칭 포함. 어려움이나 문제 상황은 절대 포함하지 말 것
- hardThing: memorableEvent와 완전히 다른 내용으로, 어려웠던 점·문제 상황·미해결 이슈만 1문장으로 작성. 해당 내용이 없으면 반드시 빈 문자열 ""
- 모든 내용은 한국어로 작성
- 일기에 언급된 구체적인 이름(고객사, 시스템, 도구 등)은 그대로 사용`

  try {
    const text = await callGroq(prompt)
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
