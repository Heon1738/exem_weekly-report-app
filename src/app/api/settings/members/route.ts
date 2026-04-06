import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, getMembers, createMember, updateMember, deleteMember } from '@/lib/notion'
import { hashPin } from '@/lib/auth'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const members = await getMembers(settings.membersDbId)
  // PIN 해시는 노출하지 않음
  return NextResponse.json(members.map(m => ({ ...m, pinHash: undefined })))
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  const { loginId, name, position, department, role } = await request.json()

  if (!loginId || !name) {
    return NextResponse.json({ error: '아이디와 이름은 필수입니다.' }, { status: 400 })
  }

  // 아이디 중복 확인
  const existingMembers = await getMembers(settings.membersDbId)
  if (existingMembers.some(m => m.loginId === loginId)) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 })
  }

  // 팀장은 1명만 허용
  if (role === 'leader') {
    const alreadyHasLeader = existingMembers.some(m => m.role === 'leader')
    if (alreadyHasLeader) {
      return NextResponse.json({ error: '팀장은 1명만 설정할 수 있습니다. 기존 팀장을 먼저 팀원으로 변경해주세요.' }, { status: 400 })
    }
  }

  const member = await createMember(settings.membersDbId, {
    loginId,
    name,
    position: position || '',
    department: department || '',
    role: role || 'member',
    pinHash: hashPin('1234'),  // 초기 PIN은 항상 1234
  })

  return NextResponse.json({ success: true, id: member.id })
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, loginId, name, position, department, role, pin } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })

  const updates: Record<string, string> = {}
  if (loginId !== undefined) updates.loginId = loginId
  if (name !== undefined) updates.name = name
  if (position !== undefined) updates.position = position
  if (department !== undefined) updates.department = department
  if (role !== undefined) updates.role = role
  if (pin !== undefined) updates.pinHash = hashPin(pin)

  await updateMember(id, updates as any)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })

  await deleteMember(id)
  return NextResponse.json({ success: true })
}
