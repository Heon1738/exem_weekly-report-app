// 팀원
export interface Member {
  id: string
  name: string
  position: string        // 직책 (예: 과장)
  department: string      // 소속 (예: DB기술본부 > DB기술연구2팀)
  role: 'leader' | 'member'
  pinHash: string
}

// 고객사 지원 범례 항목
export interface LegendItem {
  id: string
  label: string           // 예: MFO 지원, DB 점검, 장애 대응
}

// 앱 설정
export interface AppSettings {
  dailyDbId: string
  membersDbId: string
  legendsDbId: string
  teamName: string        // 예: DB기술연구2팀
  divisionName: string    // 예: DB기술본부
}

// 일일보고 업무 항목 (주간보고 매핑용)
export interface WorkItem {
  category: 'project' | 'achievement' | 'customer_support' | 'planned' | 'deq' | 'opinion'
  customerName?: string   // 고객사 지원 시
  supportType?: string    // 지원 종류 (범례)
  projectName?: string    // 프로젝트/업무명
  achievementType?: string // 성과 구분: 컨설팅, PreSales, PoC, 장애분석, 기술문서
  content: string
}

// DEQ 현황
export interface DeqStatus {
  longPending: number     // 장기 미해결 일감
  urgent: number          // 우선순위 긴급 일감
}

// 일일보고
export interface DailyReport {
  id?: string
  date: string            // YYYY-MM-DD
  authorName: string
  emotion: string         // 이모지
  memorableEvent: string  // 기억에 남는 일
  hardThing: string       // 힘들었던 점
  dailyFeeling: string    // 하루 느낀점
  workItems: WorkItem[]   // 업무 항목들
  deqStatus?: DeqStatus
  opinion?: string        // 팀에 대한 의견
}

// 주간보고 섹션
export interface WeeklySection1Item {
  projectName: string
  items: string[]
}

export interface WeeklySection2Item {
  type: string            // 컨설팅, PreSales, PoC, 장애분석, 기술문서
  items: string[]
}

export interface WeeklySection3Customer {
  customerName: string
  authorName: string
  supportItems: {
    supportType: string
    items: string[]
  }[]
}

export interface WeeklyReport {
  id?: string
  title: string           // 예: 5월 2주차 주간 보고
  weekStart: string       // YYYY-MM-DD (월요일)
  weekEnd: string         // YYYY-MM-DD (금요일)
  authorName: string
  createdDate: string
  mappedDates: string[]   // 이미 매핑된 날짜 목록
  section1: WeeklySection1Item[]
  section2: WeeklySection2Item[]
  section3: WeeklySection3Customer[]
  section4: string[]
  section5?: DeqStatus
  section6: string
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

// 성과 구분 목록
export const ACHIEVEMENT_TYPES = ['컨설팅', 'PreSales', 'PoC', '장애분석', '기술문서 공유']
