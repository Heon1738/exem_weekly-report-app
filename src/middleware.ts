import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'weekly-report-app-secret-key'
)

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/members', '/api/setup', '/api/auth/change-pin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('weekly_report_session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)

    // 설정 페이지는 팀장만
    if (pathname.startsWith('/settings') && payload.role !== 'leader') {
      return NextResponse.redirect(new URL('/daily', request.url))
    }

    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
