import { NextResponse } from 'next/server'
import { initializeAppDatabases, createMember } from '@/lib/notion'
import { hashPin } from '@/lib/auth'

export async function POST() {
  try {
    const settings = await initializeAppDatabases()

    // 기본 팀장 계정 생성 (김종헌 과장)
    await createMember(settings.membersDbId, {
      loginId: 'kjh',
      name: '김종헌',
      position: '과장',
      department: '통합기술본부 > 통합기술연구3팀',
      role: 'leader',
      pinHash: hashPin('1234'),
    })

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: '초기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
