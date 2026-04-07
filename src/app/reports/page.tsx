import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')
  if (session.role === 'member') redirect('/daily')
  // test 역할도 보고관리 접근 허용 (블러 처리됨)
  return <ReportsClient session={session} />
}
