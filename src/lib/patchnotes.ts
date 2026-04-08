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
    date: '2026-04-07',
    items: [
      'admin 계정 블러 처리 위치 변경: 일일보고/주간보고 탭 → 보고관리 탭 내부로 이동',
      '주차 표기 수정: 월 경계 주간(예: 3/31~4/4) → 새 달 1주차로 표기',
      'UI 전면 개선: Inter 폰트 적용, 카드 섀도우, 버튼 호버 효과, 스크롤바 스타일',
      'Navbar 리디자인: sticky 헤더, SVG 로고, 활성 탭 강조, 모바일 햄버거 메뉴',
      'Notion 연동 가이드 상세화: DB ID 찾는 방법 단계별 안내',
    ],
  },
  {
    date: '2026-04-08',
    items: [
      'test 계정 추가: 데이터 저장 없이 기능 체험 가능 (패스워드: 1234)',
      'test 권한: 보고관리 블러 처리, 저장/삭제/내보내기 비활성화',
      '주간보고 자동생성: 생성할 주차 다중 선택 기능',
      '패치노트 페이지 추가: admin 계정 전용 전체 이력 조회',
      '로그인 화면: 최신 패치노트를 로그인 폼 하단에 표시',
    ],
  },
]

// 로그인 화면용 — 최신 날짜만 반환
export const LATEST_PATCH = PATCH_NOTES[PATCH_NOTES.length - 1]
