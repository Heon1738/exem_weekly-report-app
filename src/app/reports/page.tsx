import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')
  if (session.role === 'member') redirect('/daily')
  return <ReportsClient session={session} />
}
