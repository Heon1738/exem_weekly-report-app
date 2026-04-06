import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// types/index.ts의 EMOTION_OPTIONS와 동일하게 유지
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

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dailyFeeling } = await request.json()
  if (!dailyFeeling?.trim()) {
    return NextResponse.json({ error: '하루 느낀점을 입력해주세요.' }, { status: 400 })
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const emotionList = EMOTION_OPTIONS.map(e => `${e.emoji}(${e.label})`).join(', ')

  const prompt = `당신은 직장인의 하루 일기를 분석하는 전문가입니다.
아래 하루 느낀점을 읽고 JSON만 반환하세요. 다른 텍스트, 마크다운, 코드블록 없이 순수 JSON만 출력하세요.

하루 느낀점: ${dailyFeeling}

반환 형식(반드시 이 형식 그대로):
{"emotion":"이모지","memorableEvent":"요약문","hardThing":"요약문또는빈문자열"}

규칙:
- emotion: 다음 중 하나만 선택 → ${emotionList}
- memorableEvent: 핵심 내용을 1~2문장으로 요약 (원문 그대로 복사 금지)
- hardThing: 힘든 내용이 없으면 빈 문자열("")
- 한국어로 작성`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    })
    const text = result.response.text().trim()

    // JSON 파싱 (마크다운 코드블록 등 감싸진 경우 대비)
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? text
    const parsed = JSON.parse(jsonStr)

    // emotion이 목록에 없으면 기본값
    const validEmojis = EMOTION_OPTIONS.map(e => e.emoji)
    const emotion = validEmojis.includes(parsed.emotion) ? parsed.emotion : '😐'

    return NextResponse.json({
      emotion,
      memorableEvent: parsed.memorableEvent || '',
      hardThing: parsed.hardThing || '',
    })
  } catch (e: any) {
    if (e?.status === 429) {
      return NextResponse.json({ error: 'AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }
    console.error('Autofill error:', e)
    return NextResponse.json({ error: '자동 채우기에 실패했습니다.' }, { status: 500 })
  }
}
