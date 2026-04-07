import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'

// Google Sheets 일일보고와 동일한 감정 선택지
const EMOTION_OPTIONS = [
  '연차',
  '💡 새로움',
  '😊만족',
  '😎뿌듯',
  '😐무난',
  '😕혼란',
  '😠스트레스',
  '😥답답',
  '😩피로',
  '🤔고민',
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

  const systemMessage = `당신은 IT 직장인의 하루 일기에서 감정·기억에 남는 일·힘들었던 점을 추출하는 분석가입니다.
반드시 순수 JSON만 출력합니다. 마크다운·코드블록·부연 설명은 절대 출력하지 않습니다.
출력 형식: {"emotion":"값","memorableEvent":"값","hardThing":"값"}`

  // 실제 일일보고 데이터 기반 few-shot 예시 (다양한 유형 커버)
  const fewShot: { role: string; content: string }[] = [
    {
      role: 'user',
      content: '일기: "신한캐피탈에서 MFT 빌드하는데 zlog 포함 여부를 사전에 협의를 안 해서 문제가 됐다. 이미 고객한테 약속한 내용이 바뀌면서 신뢰가 좀 떨어진 것 같다. 소통 오류가 계속 반복되는 게 너무 힘들다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😠스트레스","memorableEvent":"신한캐피탈 MFT 빌드 중 zlog 포함 여부 소통 오류로 고객 신뢰 손상","hardThing":"반복되는 소통 오류"}',
    },
    {
      role: 'user',
      content: '일기: "기획재정부 설치 가는데 포트가 안 열려있었다. 오전 내내 기다리다가 결국 설치 못하고 다음에 다시 오기로 했다. 스트레스 엄청 받았다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😠스트레스","memorableEvent":"기획재정부 포트 미오픈으로 설치 미진행 및 재방문 확정","hardThing":"오전 내내 대기 후 포트 미오픈으로 설치 미진행"}',
    },
    {
      role: 'user',
      content: '일기: "4일 컨설팅에서 배운 튜닝 원리를 오늘 실제 쿼리에 직접 적용해봤는데 잘 됐다. 테스트까지 완료했다. 정말 뿌듯하다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😎뿌듯","memorableEvent":"4일간 컨설팅 경험으로 실제 쿼리에 튜닝 원리 직접 적용 및 테스트 완료","hardThing":"없음"}',
    },
    {
      role: 'user',
      content: '일기: "낮에는 현장 설치 작업하고 저녁엔 패치까지 해야 했다. 기한 맞추려고 새벽까지 캡처본 받아서 검수보고서까지 써야 해서 몸이 완전히 지쳤다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😩피로","memorableEvent":"낮에는 설치, 밤에는 패치","hardThing":"기한 맞추기 위해 새벽까지 캡처본 대기 후 검수보고서 작성"}',
    },
    {
      role: 'user',
      content: '일기: "오늘 AXA다이렉트 정기 점검 다녀왔다. 특별한 이슈 없이 순조롭게 완료했다. 평범한 하루였다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😐무난","memorableEvent":"AXA다이렉트 이슈 없이 점검 완료","hardThing":"없음"}',
    },
    {
      role: 'user',
      content: '일기: "분당 서울대병원 가는데 금요일 교통 체증 때문에 복귀하는 데 두 배나 걸렸다. 지원 자체는 잘 마무리했는데 이동 시간이 너무 힘들었다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😩피로","memorableEvent":"분당 서울대병원 지원 후 금요일 교통 체증으로 복귀 시간 두 배 소요","hardThing":"금요일 교통 체증"}',
    },
    {
      role: 'user',
      content: '일기: "서울대 DR 서버 교체 후 Maxgauge 재설치했는데 네트워크 문제가 생겨서 오늘 못 끝내고 내일 다시 방문하기로 했다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😠스트레스","memorableEvent":"서울대 DR 서버 교체 후 Maxgauge 재설치, 네트워크 문제로 익일 재방문 확정","hardThing":"네트워크 문제"}',
    },
    {
      role: 'user',
      content: '일기: "한전 점검하다가 DG act 파일 갱신 여부를 한번에 확인하는 스크립트를 만들었다. 생각보다 잘 돼서 뿌듯했다."',
    },
    {
      role: 'assistant',
      content: '{"emotion":"😎뿌듯","memorableEvent":"한전 점검 중 DG act 파일 갱신 여부를 한번에 확인하는 스크립트 작성","hardThing":"없음"}',
    },
  ]

  const userMessage = `[감정 선택지 - 반드시 아래 중 하나만 선택]
${EMOTION_OPTIONS.join(' / ')}
(연차·반차·대휴 기록이면 "연차" 선택)

[추출 규칙]
emotion: 일기 전체 분위기에서 가장 지배적인 감정 1개를 선택지에서 정확히 선택
memorableEvent: 오늘 하루에서 가장 기억에 남는 단일 사건 1가지. 업무·이동·식사·개인 이벤트 모두 포함 가능. 일기 전체 요약 금지. 고객사·시스템 등 구체적 명칭 그대로 사용. 한 문장으로 간결하게
hardThing: 가장 힘들었던 점·문제·이슈 1가지. 없으면 반드시 "없음"

일기: "${dailyFeeling}"`

  try {
    const text = await callGroq([
      { role: 'system', content: systemMessage },
      ...fewShot,
      { role: 'user', content: userMessage },
    ])

    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) throw new Error('JSON을 찾을 수 없습니다.')

    const parsed = JSON.parse(jsonMatch[0])
    const emotion = EMOTION_OPTIONS.includes(parsed.emotion) ? parsed.emotion : '😐무난'

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
