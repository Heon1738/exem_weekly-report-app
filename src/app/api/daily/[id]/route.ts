import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getDailyReport, updateDailyReport, deleteDailyReport } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getDailyReport(params.id)
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  if (session.role !== 'leader' && report.authorName !== session.name) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(report)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getDailyReport(params.id)
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  if (session.role !== 'leader' && report.authorName !== session.name) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  await updateDailyReport(params.id, {
    emotion: body.emotion,
    memorableEvent: body.memorableEvent,
    hardThing: body.hardThing,
    dailyFeeling: body.dailyFeeling,
    customerName: body.customerName,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getDailyReport(params.id)
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  if (session.role !== 'leader' && report.authorName !== session.name) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await deleteDailyReport(params.id)
  return NextResponse.json({ success: true })
}
