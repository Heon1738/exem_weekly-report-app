import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')
  if (session.role !== 'leader') redirect('/daily')

  return <SettingsClient session={session} />
}
