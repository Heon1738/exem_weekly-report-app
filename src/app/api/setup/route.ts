import { NextResponse } from 'next/server'
import { initializeAppDatabases } from '@/lib/notion'

export async function POST() {
  try {
    const settings = await initializeAppDatabases()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: '초기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
