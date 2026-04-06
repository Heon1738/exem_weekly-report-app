import { NextResponse } from 'next/server'
import { getAppSettings, getMembers } from '@/lib/notion'

// 로그인 페이지용 공개 엔드포인트
// { initialized: boolean, hasMembers: boolean } 반환
export async function GET() {
  try {
    const settings = await getAppSettings()
    if (!settings) {
      return NextResponse.json({ initialized: false, hasMembers: false })
    }
    const members = await getMembers(settings.membersDbId)
    return NextResponse.json({ initialized: true, hasMembers: members.length > 0, names: members.map(m => m.name) })
  } catch {
    return NextResponse.json({ initialized: false, hasMembers: false })
  }
}
