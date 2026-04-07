import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const rows = await sql`SELECT name FROM members ORDER BY created_at ASC, name ASC`
    const names: string[] = rows.map((r: Record<string, unknown>) => String(r.name))

    const response = NextResponse.json(
      names.length === 0
        ? { initialized: true, hasMembers: false, names: [] }
        : { initialized: true, hasMembers: true, names }
    )
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('CDN-Cache-Control', 'no-store')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('Members API error:', error)
    const response = NextResponse.json({ initialized: false, hasMembers: false, names: [] })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('CDN-Cache-Control', 'no-store')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store')
    return response
  }
}
