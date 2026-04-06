import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import WeeklyReportClient from './WeeklyReportClient'

export default async function WeeklyPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  return <WeeklyReportClient session={session} />
}
