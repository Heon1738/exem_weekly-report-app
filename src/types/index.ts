// 팀원
export interface Member {
  id: string
  loginId: string    // 로그인용 아이디
  name: string
  position: string
  department: string
  role: 'leader' | 'member'
  pinHash: string
}

// 고객사 지원 범례 항목
export interface LegendItem {
  id: string
  label: string
}

// 앱 설정
export interface AppSettings {
  dailyDbId: string
  membersDbId: string
  legendsDbId: string
  teamName: string
  divisionName: string
}

// 일일보고 (간소화 - 개인 회고만)
export interface DailyReport {
  id?: string
  date: string
  authorName: string
  emotion: string
  memorableEvent: string   // 기억에 남는 일 (자동 채우기)
  hardThing: string        // 힘들었던 점 (자동 채우기)
  dailyFeeling: string     // 하루 느낀점 (주 입력)
}

// 주간보고 섹션 타입
export interface Section1Item {
  projectName: string
  content: string
}

export interface Section2Item {
  achievementType: string
  content: string
}

export interface Section3Item {
  customerName: string
  supportType: string
  content: string
}

// 주간보고 초안 (웹에서 직접 작성)
export interface WeeklyDraft {
  weekStart: string
  weekEnd: string
  authorName: string
  section1: Section1Item[]
  section2: Section2Item[]
  section3: Section3Item[]
  section4: string[]
  section5: { longPending: number; urgent: number }
  section6: string         // 팀에 대한 의견 (일일보고 하루 느낀점에서 자동 집계 + 수정 가능)
  mappedDates: string[]
}

// JWT payload
export interface JwtPayload {
  memberId: string
  name: string
  role: 'leader' | 'member'
}

// 이모지 감정 목록
export const EMOTION_OPTIONS = [
  { emoji: '😊', label: '기쁨' },
  { emoji: '😄', label: '즐거움' },
  { emoji: '😐', label: '보통' },
  { emoji: '😔', label: '아쉬움' },
  { emoji: '😢', label: '슬픔' },
  { emoji: '😤', label: '답답함' },
  { emoji: '😴', label: '피곤함' },
  { emoji: '🤔', label: '고민' },
  { emoji: '💪', label: '뿌듯함' },
  { emoji: '🔥', label: '열정' },
]

export const ACHIEVEMENT_TYPES = ['컨설팅', 'PreSales', 'PoC', '장애분석', '기술문서 공유']

// 하루 느낀점 → 감정/기억/힘듦 자동 추출
export function autoFillFromFeeling(feeling: string): {
  emotion: string
  memorableEvent: string
  hardThing: string
} {
  if (!feeling.trim()) return { emotion: '😐', memorableEvent: '', hardThing: '' }

  const sentences = feeling
    .split(/[.!?。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 4)

  const hardKeywords = ['어렵', '힘들', '문제', '이슈', '고민', '아쉬', '실수', '지연', '막혔', '해결 못', '어려웠', '고생', '난감', '막막']
  const positiveKeywords = ['좋았', '즐거', '뿌듯', '성공', '완료', '해냈', '기뻤', '재밌', '잘 됐', '잘됐', '기쁘']
  const tiredKeywords = ['피곤', '지쳤', '힘든 하루', '녹초', '지치']
  const thinkKeywords = ['고민', '생각', '복잡', '어떻게']

  const hardSentences = sentences.filter(s => hardKeywords.some(k => s.includes(k)))
  const goodSentences = sentences.filter(s => !hardKeywords.some(k => s.includes(k)))

  let emotion = '😐'
  if (positiveKeywords.some(k => feeling.includes(k))) emotion = '💪'
  else if (tiredKeywords.some(k => feeling.includes(k))) emotion = '😴'
  else if (thinkKeywords.some(k => feeling.includes(k))) emotion = '🤔'
  else if (hardKeywords.some(k => feeling.includes(k))) emotion = '😔'
  else if (feeling.length > 30) emotion = '😊'

  return {
    emotion,
    memorableEvent: goodSentences.slice(0, 2).join('. ') || feeling.slice(0, 80),
    hardThing: hardSentences.join('. '),
  }
}
