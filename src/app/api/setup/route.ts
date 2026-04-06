import { NextResponse } from 'next/server'
import { initSchema } from '@/lib/db'

export async function POST() {
  try {
    await initSchema()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: '초기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
