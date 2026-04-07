import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DailyReportClient from './DailyReportClient'

export default async function DailyPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')
  if (session.role === 'leader') redirect('/reports')

  return <DailyReportClient session={session} />
}
