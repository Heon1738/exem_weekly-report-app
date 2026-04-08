import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getUnreadFeedbackCount } from '@/lib/db'

// GET — admin 전용: 미확인 건수
export async function GET() {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'admin') return NextResponse.json({ count: 0 })
  const count = await getUnreadFeedbackCount()
  return NextResponse.json({ count })
}
