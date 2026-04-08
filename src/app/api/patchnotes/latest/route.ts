import { NextResponse } from 'next/server'
import { getLatestPatchNote } from '@/lib/db'

// GET — 공개: 로그인 화면에서 최신 패치노트 표시용
export async function GET() {
  const note = await getLatestPatchNote()
  return NextResponse.json(note)
}
