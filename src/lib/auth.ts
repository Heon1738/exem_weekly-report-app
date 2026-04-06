import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { JwtPayload } from '@/types'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'weekly-report-app-secret-key'
)
const COOKIE_NAME = 'weekly_report_session'

export function hashPin(pin: string): string {
  // 간단한 해시 (프로덕션에서는 bcrypt 권장)
  let hash = 0
  const str = pin + 'weekly_report_salt_2024'
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export async function createSession(payload: JwtPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export async function getSessionFromCookies(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export { COOKIE_NAME }
