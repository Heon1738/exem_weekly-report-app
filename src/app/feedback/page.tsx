import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import FeedbackClient from './FeedbackClient'

export default async function FeedbackPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')
  if (session.role === 'leader') redirect('/reports')
  return <FeedbackClient session={session} />
}
