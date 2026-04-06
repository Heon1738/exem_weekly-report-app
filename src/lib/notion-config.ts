import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'weekly-report-app-secret-key')
export const NOTION_CONFIG_COOKIE = 'notion_config'

export interface NotionConfig {
  token: string
  parentPageId: string
}

export async function getNotionConfig(): Promise<NotionConfig | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(NOTION_CONFIG_COOKIE)?.value
    if (!raw) return null
    const { payload } = await jwtVerify(raw, SECRET)
    return { token: payload.token as string, parentPageId: payload.parentPageId as string }
  } catch { return null }
}

export async function createNotionConfigToken(config: NotionConfig): Promise<string> {
  return await new SignJWT({ ...config })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET)
}
