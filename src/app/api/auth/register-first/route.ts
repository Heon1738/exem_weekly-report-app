import { NextRequest, NextResponse } from 'next/server'
import { getMembers, createMember } from '@/lib/db'
import { hashPin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const members = await getMembers()
    if (members.length > 0) {
      return NextResponse.json({ error: '이미 등록된 계정이 존재합니다.' }, { status: 400 })
    }

    const { name, position, department } = await request.json()
    if (!name || !position || !department) {
      return NextResponse.json({ error: '이름, 직책, 부서를 모두 입력해주세요.' }, { status: 400 })
    }

    await createMember({
      name: name.trim(),
      position: position.trim(),
      department: department.trim(),
      role: 'leader',
      pinHash: hashPin('1234'),
      notionPageId: '',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Register first error:', error)
    return NextResponse.json({ error: '계정 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
