import { getSessionFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PatchNotesClient from './PatchNotesClient'

export default async function PatchNotesPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/daily')
  return <PatchNotesClient session={session} />
}
