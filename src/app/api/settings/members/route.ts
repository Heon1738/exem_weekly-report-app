import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getMembers, createMember, updateMember, deleteMember } from '@/lib/db'
import { hashPin } from '@/lib/auth'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const members = await getMembers()
  return NextResponse.json(members.map(m => ({ ...m, pinHash: undefined })))
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, position, department, role } = await request.json()
  if (!name) return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 })
  const existingMembers = await getMembers()
  if (existingMembers.some(m => m.name === name)) return NextResponse.json({ error: '이미 등록된 이름입니다.' }, { status: 400 })
  if (role === 'leader') {
    const alreadyHasLeader = existingMembers.some(m => m.role === 'leader')
    if (alreadyHasLeader) return NextResponse.json({ error: '팀장은 1명만 설정할 수 있습니다. 기존 팀장을 먼저 팀원으로 변경해주세요.' }, { status: 400 })
  }
  const member = await createMember({ name, position: position || '', department: department || '', role: role || 'member', pinHash: hashPin('1234'), notionPageId: '' })
  return NextResponse.json({ success: true, id: member.id })
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, position, department, role, pin, notionPageId } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })

  if (session.role === 'leader') {
    // Leader can update anything
    const updates: Record<string, string> = {}
    if (name !== undefined) updates.name = name
    if (position !== undefined) updates.position = position
    if (department !== undefined) updates.department = department
    if (role !== undefined) updates.role = role
    if (pin !== undefined) updates.pinHash = hashPin(pin)
    if (notionPageId !== undefined) updates.notionPageId = notionPageId
    await updateMember(id, updates as any)
  } else {
    // Member can only update their own profile (not role, not name)
    const members = await getMembers()
    const self = members.find(m => m.name === session.name)
    if (!self || self.id !== id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const updates: Record<string, string> = {}
    if (position !== undefined) updates.position = position
    if (department !== undefined) updates.department = department
    if (pin !== undefined) updates.pinHash = hashPin(pin)
    if (notionPageId !== undefined) updates.notionPageId = notionPageId
    await updateMember(id, updates as any)
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
  await deleteMember(id)
  return NextResponse.json({ success: true })
}
