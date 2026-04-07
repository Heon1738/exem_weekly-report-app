import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getLegends, createLegend, deleteLegend } from '@/lib/db'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const legends = await getLegends()
    return NextResponse.json(legends)
  } catch (err: any) {
    console.error('Legend fetch error:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { label } = await request.json()
  if (!label) return NextResponse.json({ error: '항목명이 필요합니다.' }, { status: 400 })
  try {
    const legend = await createLegend(label)
    return NextResponse.json({ success: true, ...legend })
  } catch (err: any) {
    console.error('Legend creation error:', err)
    return NextResponse.json({ error: err.message || '범례 추가에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || !['leader', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
  await deleteLegend(id)
  return NextResponse.json({ success: true })
}
