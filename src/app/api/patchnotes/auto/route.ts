import { NextRequest, NextResponse } from 'next/server'
import { upsertPatchNote } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST — GitHub Actions에서 호출: 커밋 메시지 → Groq로 패치노트 생성 → DB 저장
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-patchnotes-secret')
  if (!secret || secret !== process.env.PATCHNOTES_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { commits, date } = await request.json()
  if (!commits || !Array.isArray(commits) || commits.length === 0) {
    return NextResponse.json({ error: 'commits 배열이 필요합니다.' }, { status: 400 })
  }

  const noteDate = date || new Date().toISOString().split('T')[0]

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  // Groq로 패치노트 항목 생성
  const prompt = `다음은 웹 서비스의 Git 커밋 메시지 목록입니다. 이를 분석하여 사용자가 이해하기 쉬운 한국어 패치노트 항목을 생성해주세요.

커밋 메시지:
${commits.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

규칙:
- 각 항목은 사용자 관점에서 변경된 기능을 간결하게 설명 (1-2문장)
- 내부 구현 세부사항(리팩토링, 타입 수정 등)은 제외
- 중복되거나 사소한 변경(오타 수정, 주석 등)은 제외
- 3~7개 항목으로 요약
- 각 항목을 JSON 배열의 문자열로 반환
- 반드시 JSON 배열만 반환, 다른 텍스트 없이

예시 출력: ["신규 기능 추가: 패치노트 자동 생성", "로그인 화면 UI 개선"]`

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    return NextResponse.json({ error: `Groq API 오류: ${err}` }, { status: 500 })
  }

  const groqData = await groqRes.json()
  const content = groqData.choices?.[0]?.message?.content?.trim() ?? ''

  let items: string[]
  try {
    // JSON 배열 파싱 (```json ... ``` 래퍼 제거)
    const cleaned = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
    items = JSON.parse(cleaned)
    if (!Array.isArray(items) || items.length === 0) throw new Error('빈 배열')
  } catch {
    return NextResponse.json({ error: `Groq 응답 파싱 실패: ${content}` }, { status: 500 })
  }

  const id = await upsertPatchNote(noteDate, items)
  return NextResponse.json({ success: true, id, date: noteDate, items })
}
