# weekly-report-app

팀 일일보고/주간보고 웹 시스템. GitHub push → Vercel 자동배포.

## 스택
- **프레임워크**: Next.js 14 App Router + TypeScript
- **DB**: Neon PostgreSQL (`@neondatabase/serverless`, Prisma 없음, 직접 SQL)
- **인증**: JWT (`jose`) + httpOnly 쿠키 (7일)
- **AI**: Groq API (`llama-3.3-70b-versatile`) — 자동채우기
- **Notion**: `@notionhq/client` — 주간보고 내보내기
- **스타일**: Tailwind CSS (Notion 테마)
- **배포**: Vercel

## 디렉터리 구조
```
src/
├── app/
│   ├── api/
│   │   ├── auth/          login, logout, members(public), register-first, change-pin
│   │   ├── daily/         CRUD + autofill(Groq)
│   │   ├── weekly/        CRUD + autofill + generate(개인) + generate-all(리더) + list
│   │   ├── settings/      route.ts(조직설정) + members/ + legends/
│   │   ├── setup/         DB 스키마 초기화
│   │   └── notion-setup/  Notion 토큰 설정 (DB + 쿠키 동시 저장)
│   ├── daily/             DailyReportClient.tsx
│   ├── weekly/            WeeklyReportClient.tsx
│   ├── settings/          SettingsClient.tsx
│   ├── login/             page.tsx (use client)
│   └── notion-setup/      page.tsx
├── components/Navbar.tsx
├── lib/
│   ├── db.ts              DB CRUD (모듈레벨 sql 싱글톤)
│   ├── auth.ts            hashPin / createSession / verifySession / getSessionFromCookies
│   ├── notion.ts          exportWeeklyToNotion / exportAllMembersWeeklyToNotion
│   └── notion-config.ts   쿠키 기반 NotionConfig (JWT 인코딩)
├── types/index.ts
└── middleware.ts           JWT 검증, 공개경로 제외
```

## DB 테이블 (5개)
| 테이블 | 주요 컬럼 |
|--------|-----------|
| `app_settings` | team_name, division_name, notion_export_db_id, notion_token |
| `members` | id(uuid), name(unique), position, department, role(leader\|member), pin_hash |
| `legends` | id(uuid), label, display_order |
| `daily_reports` | id, date, author_name, customer_name, emotion, memorable_event, hard_thing, daily_feeling |
| `weekly_drafts` | id, week_start, week_end, author_name, draft_data(jsonb) |

## 핵심 타입 (`src/types/index.ts`)
```ts
AppSettings   { teamName, divisionName, notionParentPageId, notionToken }
Member        { id, name, position, department, role, pinHash }
LegendItem    { id, label }
DailyReport   { id?, date, authorName, customerName, emotion, memorableEvent, hardThing, dailyFeeling }
WeeklyDraft   { weekStart, weekEnd, authorName, section1~6, mappedDates }
JwtPayload    { memberId, name, role }
```

## API 권한 규칙
- **public**: `/api/auth/members`, `/api/auth/login`, `/api/auth/register-first`, `/api/setup`, `/api/notion-setup`
- **인증 필요**: 나머지 전부
- **leader only**: `POST /api/settings/members`, `DELETE /api/settings/members`, `DELETE /api/settings/legends`, `PATCH /api/settings`, `POST /api/weekly/generate-all`
- **모든 로그인 유저**: `POST /api/settings/legends` (범례 추가)

## Notion 내보내기 구조 (`src/lib/notion.ts`)
```
페이지
├── TOC
└── h1(toggle) "본부 > 팀 > 이름 직책"
    ├── h2 "1. 주요 업무"  → bullet(프로젝트) > bullet(내용)
    ├── h2 "2. 주요 성과"  → bullet(유형) > bullet(내용)
    ├── h2 "3. 고객사 지원" → bullet(고객사) > toggle(지원종류) > callout(내용)
    ├── h2 "4. 예정 작업"  → bullet
    ├── h2 "5. DEQ"       → bullet
    └── h2 "6. 팀 의견"   → paragraph
```
**구현 방식**: Notion API 2단계 nesting 제한 우회 → 다단계 `blocks.children.append`
1. 페이지 생성 → h1 추가
2. h1에 섹션1,2 + 섹션3 h2 append
3. 각 고객사 bullet append → bullet ID 획득 → toggle(callout포함) append
4. h1에 섹션4,5,6 append

## Notion 토큰 우선순위
`settings.notionToken(DB)` → `cookie(notion_config)` → `env NOTION_TOKEN`

토큰 설정 경로: `/notion-setup` 페이지 → DB + 쿠키 동시 저장 → **전체 팀원 공유 가능**

## 인증 흐름
1. PIN 로그인 → JWT 생성 → `weekly_report_session` 쿠키 저장
2. middleware.ts에서 모든 요청 검증
3. 로그아웃: `window.location.href = '/login'` (router cache 우회)

## 화면(UI) 파일
| 화면 | 파일 |
|------|------|
| 로그인 | `src/app/login/page.tsx` |
| 일일보고 | `src/app/daily/DailyReportClient.tsx` |
| 주간보고 | `src/app/weekly/WeeklyReportClient.tsx` |
| 환경설정 | `src/app/settings/SettingsClient.tsx` |
| Notion 연동 설정 | `src/app/notion-setup/page.tsx` |
| 상단 네비게이션 | `src/components/Navbar.tsx` |
| 전역 레이아웃 | `src/app/layout.tsx` |
| 공통 스타일 | `src/app/globals.css` |

> `daily/`, `weekly/`, `settings/`는 `page.tsx`(서버·세션확인) + `Client.tsx`(실제 UI) 분리 패턴. 화면 수정은 항상 **Client.tsx** 참조.

## 주의사항
- `db.ts` `sql`은 모듈레벨 싱글톤 (`const sql = neon(DATABASE_URL)`)
- `auth/members` 라우트는 자체 `sql` 인스턴스 사용 (공개 라우트라 db.ts 미사용)
- 스키마 마이그레이션은 `initSchema()`에서 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`로 처리
- 팀장(leader) 1명만 허용
- 초기 PIN: `1234` → 첫 로그인 시 강제 변경

## 환경변수 (`.env.local` / Vercel)
```
DATABASE_URL     Neon PostgreSQL 연결문자열
JWT_SECRET       세션 서명 키
GROQ_API_KEY     AI 자동채우기
NOTION_TOKEN     기본 Notion 토큰 (선택 — DB 설정이 우선)
```

## 배포
```bash
git push origin main   # → Vercel 자동빌드/배포
npm run build          # 로컬 빌드 확인
```
