import { NextRequest, NextResponse } from 'next/server'
import { getMembers } from '@/lib/db'
import { hashPin, createSession, COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { name, pin } = await request.json()

    if (!name || !pin) {
      return NextResponse.json({ error: '이름과 패스워드를 입력해주세요.' }, { status: 400 })
    }

    const members = await getMembers()
    const member = members.find(m => m.name === name)

    if (!member) {
      return NextResponse.json({ error: '등록되지 않은 이름입니다.' }, { status: 401 })
    }

    const pinHash = hashPin(pin)
    if (member.pinHash !== pinHash) {
      return NextResponse.json({ error: '패스워드가 올바르지 않습니다.' }, { status: 401 })
    }

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
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
