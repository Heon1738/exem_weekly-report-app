export interface PatchEntry {
  date: string
  items: string[]
}

export const PATCH_NOTES: PatchEntry[] = [
  {
    date: '2026-04-04',
    items: [
      'admin 계정 기능 추가: 보고관리 탭 접근 및 전체 Notion 내보내기',
      '보고관리: 팀원별 일일보고/주간보고 현황 조회 기능',
      'Notion 연동: 개인 토큰 및 DB ID 설정 기능',
      '주간보고: AI 자동채우기(Groq) 기능 추가',
      '환경설정: 팀원 관리, 지원 범례, 조직명 설정',
    ],
  },
  {
    date: '2026-04-08',
    items: [
      'test 계정 추가: 데이터 저장 없이 기능 체험 가능 (패스워드: 1234)',
      '보고관리: admin/test 계정 열람 블러 처리',
      '주간보고 자동생성: 생성할 주차 선택 기능',
      '주차 표기 수정: 월 경계 주간 → 새 달 1주차로 표기',
      'UI 개선: Inter 폰트, 카드 섀도우, 모바일 햄버거 메뉴',
      'Notion 연동 가이드 상세화',
    ],
  },
]

// 로그인 화면용 — 최신 날짜만 반환
export const LATEST_PATCH = PATCH_NOTES[PATCH_NOTES.length - 1]
