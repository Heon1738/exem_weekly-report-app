import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings, getMembers } from '@/lib/notion'
import { hashPin, createSession, COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { name, pin } = await request.json()

    if (!name || !pin) {
      return NextResponse.json({ error: '이름과 패스워드를 입력해주세요.' }, { status: 400 })
    }

    const settings = await getAppSettings()
    if (!settings) {
      return NextResponse.json({ error: '앱 초기 설정이 필요합니다. /api/setup을 먼저 실행해주세요.' }, { status: 500 })
    }

    const members = await getMembers(settings.membersDbId)
    const member = members.find(m => m.name === name)

    if (!member) {
      return NextResponse.json({ error: '등록되지 않은 이름입니다.' }, { status: 401 })
    }

    const pinHash = hashPin(pin)
    if (member.pinHash !== pinHash) {
      return NextResponse.json({ error: '패스워드가 올바르지 않습니다.' }, { status: 401 })
    }

    // 초기 PIN(1234) 사용 중이면 변경 강제
    const mustChangePin = member.pinHash === hashPin('1234')

    const token = await createSession({
      memberId: member.id,
      name: member.name,
      role: member.role,
    })

    const response = NextResponse.json({ success: true, name: member.name, role: member.role, mustChangePin })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
