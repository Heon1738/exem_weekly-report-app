import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { createNotionConfigToken, getNotionConfig, NOTION_CONFIG_COOKIE } from '@/lib/notion-config'

// GET: 현재 Notion 설정 상태 확인
export async function GET() {
  const config = await getNotionConfig()
  const hasEnvToken = !!(process.env.NOTION_TOKEN && process.env.NOTION_PARENT_PAGE_ID)
  return NextResponse.json({
    configured: !!(config || hasEnvToken),
    hasCustomConfig: !!config,
    hasEnvConfig: hasEnvToken,
  })
}

// POST: Notion 설정 저장
export async function POST(request: NextRequest) {
  const { token, parentPageId } = await request.json()

  if (!token?.trim() || !parentPageId?.trim()) {
    return NextResponse.json({ error: 'Notion 토큰과 부모 페이지 ID를 모두 입력해주세요.' }, { status: 400 })
  }

  // 연결 테스트
  try {
    const testClient = new Client({ auth: token.trim() })
    await testClient.blocks.children.list({ block_id: parentPageId.trim(), page_size: 1 })
  } catch (e: any) {
    return NextResponse.json({ error: `Notion 연결 실패: ${e?.message || '토큰 또는 페이지 ID를 확인해주세요.'}` }, { status: 400 })
  }

  const configToken = await createNotionConfigToken({
    token: token.trim(),
    parentPageId: parentPageId.trim(),
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set(NOTION_CONFIG_COOKIE, configToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1년
    path: '/',
  })
  return response
}

// DELETE: Notion 설정 초기화 (쿠키 삭제)
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(NOTION_CONFIG_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}
