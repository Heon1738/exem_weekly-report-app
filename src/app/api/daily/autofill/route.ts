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

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  })

  const emotionList = EMOTION_OPTIONS.map(e => `"${e.emoji}"(${e.label})`).join(', ')

  const prompt = `당신은 직장인의 하루 일기를 분석하는 전문가입니다.
아래 하루 느낀점을 읽고, 반드시 다음 JSON 스키마에 맞게 분석 결과를 반환하세요.

하루 느낀점:
"""
${dailyFeeling}
"""

JSON 스키마:
{
  "emotion": "이모지 문자 하나 (아래 목록 중 선택)",
  "memorableEvent": "기억에 남는 일 요약 (1~2문장, 원문 복사 금지, 핵심만 간결하게)",
  "hardThing": "힘들었던 점 요약 (1~2문장, 없으면 빈 문자열)"
}

감정 이모지 선택 목록: ${emotionList}

규칙:
- emotion은 반드시 위 목록의 이모지 중 하나만 선택
- memorableEvent는 원문을 그대로 복사하지 말고 핵심 내용을 짧게 요약
- hardThing은 힘들었던 내용이 없으면 "" (빈 문자열)로 반환
- 모든 필드는 한국어로 작성`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const parsed = JSON.parse(text)

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
