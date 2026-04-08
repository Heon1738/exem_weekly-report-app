import { execSync } from 'child_process'

const APP_URL = process.env.APP_URL
const PATCHNOTES_SECRET = process.env.PATCHNOTES_SECRET

if (!APP_URL || !PATCHNOTES_SECRET) {
  console.error('APP_URL, PATCHNOTES_SECRET 환경변수가 필요합니다.')
  process.exit(1)
}

// 마지막 push에 포함된 커밋 메시지 수집 (최대 20개, merge 커밋 제외)
let commits = []
try {
  const log = execSync(
    'git log --no-merges --format="%s" HEAD~10..HEAD 2>/dev/null || git log --no-merges --format="%s" HEAD~5..HEAD',
    { encoding: 'utf-8' }
  ).trim()

  commits = log
    .split('\n')
    .map(s => s.trim())
    .filter(s =>
      s.length > 0 &&
      !s.startsWith('chore:') &&
      !s.startsWith('style:') &&
      !s.startsWith('docs:') &&
      !s.toLowerCase().includes('typo') &&
      !s.toLowerCase().includes('주석')
    )
    .slice(0, 15)
} catch (e) {
  console.error('git log 실패:', e.message)
  process.exit(0) // 커밋 없으면 조용히 종료
}

if (commits.length === 0) {
  console.log('유효한 커밋이 없습니다. 패치노트를 생성하지 않습니다.')
  process.exit(0)
}

console.log(`커밋 ${commits.length}개 수집:`)
commits.forEach((c, i) => console.log(`  ${i + 1}. ${c}`))

const today = new Date().toISOString().split('T')[0]
const url = `${APP_URL}/api/patchnotes/auto`

console.log(`\n패치노트 API 호출: ${url}`)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-patchnotes-secret': PATCHNOTES_SECRET,
  },
  body: JSON.stringify({ commits, date: today }),
})

const data = await res.json()

if (!res.ok) {
  console.error('패치노트 생성 실패:', data.error)
  process.exit(1)
}

console.log('\n패치노트 생성 완료:')
data.items.forEach((item, i) => console.log(`  ${i + 1}. ${item}`))
