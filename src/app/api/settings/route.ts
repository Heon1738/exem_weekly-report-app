import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getAppSettings, updateAppSettings } from '@/lib/notion'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (!settings) return NextResponse.json({ error: '설정 없음' }, { status: 500 })

  if (session.role !== 'leader') {
    return NextResponse.json({ teamName: settings.teamName, divisionName: settings.divisionName })
  }

  return NextResponse.json(settings)
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { teamName, divisionName } = await request.json()
  await updateAppSettings({ teamName, divisionName })
  return NextResponse.json({ success: true })
}
