import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getLegends, createLegend, deleteLegend } from '@/lib/db'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const legends = await getLegends()
  return NextResponse.json(legends)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { label } = await request.json()
  if (!label) return NextResponse.json({ error: '항목명이 필요합니다.' }, { status: 400 })
  const legend = await createLegend(label)
  return NextResponse.json({ success: true, ...legend })
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
  await deleteLegend(id)
  return NextResponse.json({ success: true })
}
