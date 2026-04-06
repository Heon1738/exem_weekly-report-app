import { NextResponse } from 'next/server'
import { getMembers } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 로그인 페이지용 공개 엔드포인트
export async function GET() {
  try {
    const members = await getMembers()
    if (!members.length) {
      return NextResponse.json({ initialized: true, hasMembers: false, names: [] })
    }
    return NextResponse.json({ initialized: true, hasMembers: true, names: members.map(m => m.name) })
  } catch {
    return NextResponse.json({ initialized: false, hasMembers: false, names: [] })
  }
}
