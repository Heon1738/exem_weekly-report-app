import { neon } from '@neondatabase/serverless'
import type { Member, LegendItem, AppSettings, DailyReport, WeeklyDraft } from '@/types'

const sql = neon(process.env.DATABASE_URL!)

// ─────────────────────────────────────────────
// 스키마 초기화
// ─────────────────────────────────────────────
export async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id SERIAL PRIMARY KEY,
      team_name TEXT NOT NULL DEFAULT '통합기술연구3팀',
      division_name TEXT NOT NULL DEFAULT '통합기술본부',
      notion_export_db_id TEXT NOT NULL DEFAULT ''
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      name TEXT NOT NULL UNIQUE,
      position TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      pin_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS legends (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      label TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      date DATE NOT NULL,
      author_name TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      emotion TEXT NOT NULL DEFAULT '',
      memorable_event TEXT NOT NULL DEFAULT '',
      hard_thing TEXT NOT NULL DEFAULT '',
      daily_feeling TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, author_name)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_drafts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      author_name TEXT NOT NULL,
      draft_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(week_start, author_name)
    )
  `

  // 기존 테이블 컬럼 마이그레이션 (IF NOT EXISTS로 안전하게 추가)
  await sql`ALTER TABLE legends ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS notion_token TEXT NOT NULL DEFAULT ''`
  await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS notion_page_id TEXT NOT NULL DEFAULT ''`

  // 기본 범례 (없을 때만)
  const [{ cnt: legendCnt }] = await sql`SELECT COUNT(*)::int as cnt FROM legends`
  if (Number(legendCnt) === 0) {
    const defaults = ['DB 점검', '장애 대응', '컨설팅 지원', 'PoC 지원', '설치/구축']
    for (let i = 0; i < defaults.length; i++) {
      await sql`INSERT INTO legends (label, display_order) VALUES (${defaults[i]}, ${i})`
    }
  }

  // 기본 앱 설정 (없을 때만)
  const [{ cnt: settingsCnt }] = await sql`SELECT COUNT(*)::int as cnt FROM app_settings`
  if (Number(settingsCnt) === 0) {
    await sql`INSERT INTO app_settings (team_name, division_name, notion_export_db_id) VALUES ('통합기술연구3팀', '통합기술본부', '')`
  }
}

// ─────────────────────────────────────────────
// 앱 설정
// ─────────────────────────────────────────────
export async function getAppSettings(): Promise<AppSettings | null> {
  try {
    let rows
    try {
      rows = await sql`SELECT team_name, division_name, notion_export_db_id, notion_token FROM app_settings LIMIT 1`
    } catch {
      await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS notion_token TEXT NOT NULL DEFAULT ''`
      rows = await sql`SELECT team_name, division_name, notion_export_db_id, notion_token FROM app_settings LIMIT 1`
    }
    if (!rows.length) return null
    const r = rows[0]
    return {
      teamName: r.team_name,
      divisionName: r.division_name,
      notionParentPageId: r.notion_export_db_id,
      notionToken: r.notion_token || '',
    }
  } catch { return null }
}

export async function updateAppSettings(updates: Partial<Pick<AppSettings, 'teamName' | 'divisionName' | 'notionParentPageId' | 'notionToken'>>): Promise<void> {
  const current = await getAppSettings()
  if (!current) return
  const merged = { ...current, ...updates }
  await sql`
    UPDATE app_settings
    SET team_name=${merged.teamName},
        division_name=${merged.divisionName},
        notion_export_db_id=${merged.notionParentPageId},
        notion_token=${merged.notionToken || ''}
    WHERE id=(SELECT id FROM app_settings LIMIT 1)
  `
}

// ─────────────────────────────────────────────
// 팀원 관리
// ─────────────────────────────────────────────
export async function getMembers(): Promise<Member[]> {
  let rows
  try {
    rows = await sql`SELECT id, name, position, department, role, pin_hash, notion_page_id FROM members ORDER BY created_at`
  } catch {
    await sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS notion_page_id TEXT NOT NULL DEFAULT ''`
    rows = await sql`SELECT id, name, position, department, role, pin_hash, notion_page_id FROM members ORDER BY created_at`
  }
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    position: r.position,
    department: r.department,
    role: r.role as 'leader' | 'member',
    pinHash: r.pin_hash,
    notionPageId: r.notion_page_id || '',
  }))
}

export async function createMember(member: Omit<Member, 'id'>): Promise<Member> {
  const [row] = await sql`
    INSERT INTO members (name, position, department, role, pin_hash)
    VALUES (${member.name}, ${member.position}, ${member.department}, ${member.role}, ${member.pinHash})
    RETURNING id
  `
  return { ...member, id: row.id }
}

export async function updateMember(memberId: string, member: Partial<Omit<Member, 'id'>>): Promise<void> {
  if (member.name !== undefined) await sql`UPDATE members SET name=${member.name} WHERE id=${memberId}`
  if (member.position !== undefined) await sql`UPDATE members SET position=${member.position} WHERE id=${memberId}`
  if (member.department !== undefined) await sql`UPDATE members SET department=${member.department} WHERE id=${memberId}`
  if (member.role !== undefined) await sql`UPDATE members SET role=${member.role} WHERE id=${memberId}`
  if (member.pinHash !== undefined) await sql`UPDATE members SET pin_hash=${member.pinHash} WHERE id=${memberId}`
  if (member.notionPageId !== undefined) await sql`UPDATE members SET notion_page_id=${member.notionPageId} WHERE id=${memberId}`
}

export async function deleteMember(memberId: string): Promise<void> {
  await sql`DELETE FROM members WHERE id=${memberId}`
}

export async function getMembersSummary(): Promise<{ name: string; position: string; department: string; lastDailyDate: string | null; lastWeeklyStart: string | null }[]> {
  const rows = await sql`
    SELECT
      m.name, m.position, m.department,
      (SELECT MAX(date)::text FROM daily_reports WHERE author_name = m.name) as last_daily,
      (SELECT MAX(week_start)::text FROM weekly_drafts WHERE author_name = m.name) as last_weekly
    FROM members m
    WHERE m.role = 'member'
    ORDER BY m.created_at
  `
  return rows.map(r => ({
    name: r.name,
    position: r.position,
    department: r.department,
    lastDailyDate: r.last_daily ? r.last_daily.slice(0, 10) : null,
    lastWeeklyStart: r.last_weekly ? r.last_weekly.slice(0, 10) : null,
  }))
}

// ─────────────────────────────────────────────
// 범례 관리
// ─────────────────────────────────────────────
export async function getLegends(): Promise<LegendItem[]> {
  const rows = await sql`SELECT id, label FROM legends ORDER BY display_order, created_at`
  return rows.map(r => ({ id: r.id, label: r.label }))
}

export async function createLegend(label: string): Promise<LegendItem> {
  const [row] = await sql`INSERT INTO legends (label) VALUES (${label}) RETURNING id`
  return { id: row.id, label }
}

export async function deleteLegend(legendId: string): Promise<void> {
  await sql`DELETE FROM legends WHERE id=${legendId}`
}

// ─────────────────────────────────────────────
// 일일보고 CRUD
// ─────────────────────────────────────────────
export async function getDailyReports(authorName: string, weekStart?: string, weekEnd?: string): Promise<DailyReport[]> {
  let rows
  if (weekStart && weekEnd) {
    rows = await sql`
      SELECT id, date::text, author_name, customer_name, emotion, memorable_event, hard_thing, daily_feeling
      FROM daily_reports
      WHERE author_name=${authorName} AND date >= ${weekStart}::date AND date <= ${weekEnd}::date
      ORDER BY date DESC
    `
  } else if (weekStart) {
    rows = await sql`
      SELECT id, date::text, author_name, customer_name, emotion, memorable_event, hard_thing, daily_feeling
      FROM daily_reports
      WHERE author_name=${authorName} AND date >= ${weekStart}::date
      ORDER BY date DESC
    `
  } else {
    rows = await sql`
      SELECT id, date::text, author_name, customer_name, emotion, memorable_event, hard_thing, daily_feeling
      FROM daily_reports
      WHERE author_name=${authorName}
      ORDER BY date DESC
    `
  }
  return rows.map(r => ({
    id: r.id,
    date: r.date.slice(0, 10),
    authorName: r.author_name,
    customerName: r.customer_name,
    emotion: r.emotion,
    memorableEvent: r.memorable_event,
    hardThing: r.hard_thing,
    dailyFeeling: r.daily_feeling,
  }))
}

export async function getDailyReport(reportId: string): Promise<DailyReport | null> {
  try {
    const rows = await sql`
      SELECT id, date::text, author_name, customer_name, emotion, memorable_event, hard_thing, daily_feeling
      FROM daily_reports WHERE id=${reportId}
    `
    if (!rows.length) return null
    const r = rows[0]
    return {
      id: r.id,
      date: r.date.slice(0, 10),
      authorName: r.author_name,
      customerName: r.customer_name,
      emotion: r.emotion,
      memorableEvent: r.memorable_event,
      hardThing: r.hard_thing,
      dailyFeeling: r.daily_feeling,
    }
  } catch { return null }
}

export async function createDailyReport(report: DailyReport): Promise<string> {
  const [row] = await sql`
    INSERT INTO daily_reports (date, author_name, customer_name, emotion, memorable_event, hard_thing, daily_feeling)
    VALUES (${report.date}::date, ${report.authorName}, ${report.customerName || ''}, ${report.emotion || ''}, ${report.memorableEvent || ''}, ${report.hardThing || ''}, ${report.dailyFeeling || ''})
    ON CONFLICT (date, author_name) DO UPDATE SET
      customer_name=EXCLUDED.customer_name,
      emotion=EXCLUDED.emotion,
      memorable_event=EXCLUDED.memorable_event,
      hard_thing=EXCLUDED.hard_thing,
      daily_feeling=EXCLUDED.daily_feeling,
      updated_at=NOW()
    RETURNING id
  `
  return row.id
}

export async function deleteDailyReport(reportId: string): Promise<void> {
  await sql`DELETE FROM daily_reports WHERE id=${reportId}`
}

export async function updateDailyReport(reportId: string, report: Partial<DailyReport>): Promise<void> {
  if (report.emotion !== undefined) await sql`UPDATE daily_reports SET emotion=${report.emotion}, updated_at=NOW() WHERE id=${reportId}`
  if (report.memorableEvent !== undefined) await sql`UPDATE daily_reports SET memorable_event=${report.memorableEvent}, updated_at=NOW() WHERE id=${reportId}`
  if (report.hardThing !== undefined) await sql`UPDATE daily_reports SET hard_thing=${report.hardThing}, updated_at=NOW() WHERE id=${reportId}`
  if (report.dailyFeeling !== undefined) await sql`UPDATE daily_reports SET daily_feeling=${report.dailyFeeling}, updated_at=NOW() WHERE id=${reportId}`
  if (report.customerName !== undefined) await sql`UPDATE daily_reports SET customer_name=${report.customerName}, updated_at=NOW() WHERE id=${reportId}`
}

// ─────────────────────────────────────────────
// 주간보고 초안 저장/로드
// ─────────────────────────────────────────────
export async function saveWeeklyDraft(draft: WeeklyDraft): Promise<string> {
  const [row] = await sql`
    INSERT INTO weekly_drafts (week_start, week_end, author_name, draft_data)
    VALUES (${draft.weekStart}::date, ${draft.weekEnd}::date, ${draft.authorName}, ${JSON.stringify(draft)}::jsonb)
    ON CONFLICT (week_start, author_name) DO UPDATE SET
      draft_data=${JSON.stringify(draft)}::jsonb,
      updated_at=NOW()
    RETURNING id
  `
  return row.id
}

export async function loadWeeklyDraft(weekStart: string, weekEnd: string, authorName: string): Promise<WeeklyDraft | null> {
  try {
    const rows = await sql`
      SELECT draft_data FROM weekly_drafts
      WHERE week_start=${weekStart}::date AND author_name=${authorName}
    `
    if (!rows.length) return null
    return rows[0].draft_data as WeeklyDraft
  } catch { return null }
}

export async function deleteWeeklyDraft(weekStart: string, authorName: string): Promise<void> {
  await sql`DELETE FROM weekly_drafts WHERE week_start=${weekStart}::date AND author_name=${authorName}`
}

export async function getWeeklyDraftsList(authorName: string): Promise<{ weekStart: string; weekEnd: string; updatedAt: string }[]> {
  try {
    const rows = await sql`
      SELECT week_start::text, week_end::text, updated_at
      FROM weekly_drafts
      WHERE author_name=${authorName}
      ORDER BY week_start DESC
    `
    return rows.map(r => ({
      weekStart: r.week_start.slice(0, 10),
      weekEnd: r.week_end.slice(0, 10),
      updatedAt: r.updated_at,
    }))
  } catch { return [] }
}
