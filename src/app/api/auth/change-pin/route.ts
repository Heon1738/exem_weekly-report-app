import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies, hashPin } from '@/lib/auth'
import { getMembers, updateMember } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPin, newPin } = await request.json()

  if (!currentPin || !newPin) {
    return NextResponse.json({ error: '현재 패스워드와 새 패스워드를 입력해주세요.' }, { status: 400 })
  }
  if (newPin.length < 4) {
    return NextResponse.json({ error: '패스워드는 4자리 이상이어야 합니다.' }, { status: 400 })
  }
  if (newPin === '1234') {
    return NextResponse.json({ error: '1234는 사용할 수 없습니다.' }, { status: 400 })
  }

  const members = await getMembers()
  const member = members.find(m => m.name === session.name)
  if (!member) return NextResponse.json({ error: '팀원 정보를 찾을 수 없습니다.' }, { status: 404 })

  if (member.pinHash !== hashPin(currentPin)) {
    return NextResponse.json({ error: '현재 패스워드가 올바르지 않습니다.' }, { status: 400 })
  }

  await updateMember(member.id, { pinHash: hashPin(newPin) })
  return NextResponse.json({ success: true })
}
