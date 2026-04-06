import { NextResponse } from 'next/server'
import { getAppSettings, getMembers } from '@/lib/notion'

// 로그인 페이지용 공개 엔드포인트 - 이름만 반환 (PIN 등 민감 정보 제외)
export async function GET() {
  try {
    const settings = await getAppSettings()
    if (!settings) return NextResponse.json([], { status: 200 })

    const members = await getMembers(settings.membersDbId)
    return NextResponse.json(members.map(m => m.name))
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
