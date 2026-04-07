import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getMembersSummary } from '@/lib/db'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const summary = await getMembersSummary()
  return NextResponse.json(summary)
}
