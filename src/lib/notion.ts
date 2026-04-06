import { Client } from '@notionhq/client'
import { getNotionConfig } from './notion-config'
import type { Member, LegendItem, AppSettings, DailyReport, WeeklyDraft } from '@/types'

async function getNotion(): Promise<Client> {
  const config = await getNotionConfig()
  return new Client({ auth: config?.token || process.env.NOTION_TOKEN })
}

async function getDefaultParentPageId(): Promise<string> {
  const config = await getNotionConfig()
  return config?.parentPageId || process.env.NOTION_PARENT_PAGE_ID!
}

// ─────────────────────────────────────────────
// 앱 설정 초기화
// ─────────────────────────────────────────────
export async function initializeAppDatabases(): Promise<AppSettings> {
  const notion = await getNotion()
  const PARENT_PAGE_ID = await getDefaultParentPageId()

  const existing = await getAppSettings()
  if (existing) return existing

  const dailyDb = await notion.databases.create({
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: '일일보고' } }],
    properties: {
      '제목': { title: {} },
      '날짜': { date: {} },
      '작성자': { rich_text: {} },
      '감정': { rich_text: {} },
      '기억에 남는 일': { rich_text: {} },
      '힘들었던 점': { rich_text: {} },
      '하루 느낀점': { rich_text: {} },
    },
  })

  const membersDb = await notion.databases.create({
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: '팀원 설정' } }],
    properties: {
      '이름': { title: {} },
      '직책': { rich_text: {} },
      '소속': { rich_text: {} },
      '역할': { select: { options: [{ name: 'leader', color: 'blue' }, { name: 'member', color: 'gray' }] } },
      'PIN': { rich_text: {} },
    },
  })

  const legendsDb = await notion.databases.create({
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: '지원 범례 설정' } }],
    properties: { '항목명': { title: {} } },
  })

  const defaultLegends = ['DB 점검', '장애 대응', '컨설팅 지원', 'PoC 지원', '설치/구축']
  for (const label of defaultLegends) {
    await notion.pages.create({
      parent: { database_id: legendsDb.id },
      properties: { '항목명': { title: [{ text: { content: label } }] } },
    })
  }

  const settings: AppSettings = {
    dailyDbId: dailyDb.id,
    membersDbId: membersDb.id,
    legendsDbId: legendsDb.id,
    weeklyDbId: process.env.NOTION_WEEKLY_DB_ID || '',
    teamName: '통합기술연구3팀',
    divisionName: '통합기술본부',
  }

  await notion.pages.create({
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    properties: { title: [{ text: { content: '앱 설정 (수정하지 마세요)' } }] },
    children: [{
      type: 'code',
      code: { language: 'json', rich_text: [{ type: 'text', text: { content: JSON.stringify(settings, null, 2) } }] },
    }],
  })

  return settings
}

export async function getAppSettings(): Promise<AppSettings | null> {
  try {
    const notion = await getNotion()
    const PARENT_PAGE_ID = await getDefaultParentPageId()
    const blocks = await notion.blocks.children.list({ block_id: PARENT_PAGE_ID, page_size: 50 })
    for (const block of blocks.results) {
      if (block.object !== 'block') continue
      if ('type' in block && block.type === 'child_page') {
        const page = block as any
        if (page.child_page.title === '앱 설정 (수정하지 마세요)') {
          const children = await notion.blocks.children.list({ block_id: page.id })
          for (const child of children.results) {
            if (child.object !== 'block') continue
            if ('type' in child && (child as any).type === 'code') {
              const json = (child as any).code.rich_text.map((t: any) => t.plain_text).join('')
              return JSON.parse(json) as AppSettings
            }
          }
        }
      }
    }
    return null
  } catch { return null }
}

export async function updateAppSettings(updates: Partial<Pick<AppSettings, 'teamName' | 'divisionName' | 'weeklyDbId'>>): Promise<void> {
  try {
    const notion = await getNotion()
    const PARENT_PAGE_ID = await getDefaultParentPageId()
    const blocks = await notion.blocks.children.list({ block_id: PARENT_PAGE_ID, page_size: 50 })
    for (const block of blocks.results) {
      if (block.object !== 'block') continue
      if ('type' in block && block.type === 'child_page') {
        const page = block as any
        if (page.child_page.title === '앱 설정 (수정하지 마세요)') {
          const children = await notion.blocks.children.list({ block_id: page.id })
          for (const child of children.results) {
            if (child.object !== 'block') continue
            if ('type' in child && (child as any).type === 'code') {
              const codeBlock = child as any
              const json = codeBlock.code.rich_text.map((t: any) => t.plain_text).join('')
              const current = JSON.parse(json) as AppSettings
              const updated = { ...current, ...updates }
              await notion.blocks.update({
                block_id: codeBlock.id,
                code: { rich_text: [{ type: 'text', text: { content: JSON.stringify(updated, null, 2) } }], language: 'json' },
              } as any)
              return
            }
          }
        }
      }
    }
  } catch (e) { console.error('updateAppSettings error:', e) }
}

// ─────────────────────────────────────────────
// 팀원 관리
// ─────────────────────────────────────────────

async function ensureCustomerNameColumn(dailyDbId: string, notion: Client): Promise<void> {
  try {
    const db = await notion.databases.retrieve({ database_id: dailyDbId }) as any
    if (!db.properties['고객사명']) {
      await notion.databases.update({
        database_id: dailyDbId,
        properties: { '고객사명': { rich_text: {} } },
      } as any)
    }
  } catch {}
}

export async function getMembers(membersDbId: string): Promise<Member[]> {
  const notion = await getNotion()
  const res = await notion.databases.query({ database_id: membersDbId })
  return res.results.map((page: any) => ({
    id: page.id,
    name: page.properties['이름']?.title?.[0]?.plain_text ?? '',
    position: page.properties['직책']?.rich_text?.[0]?.plain_text ?? '',
    department: page.properties['소속']?.rich_text?.[0]?.plain_text ?? '',
    role: (page.properties['역할']?.select?.name ?? 'member') as 'leader' | 'member',
    pinHash: page.properties['PIN']?.rich_text?.[0]?.plain_text ?? '',
  }))
}

export async function createMember(membersDbId: string, member: Omit<Member, 'id'>): Promise<Member> {
  const notion = await getNotion()
  const page = await notion.pages.create({
    parent: { database_id: membersDbId },
    properties: {
      '이름': { title: [{ text: { content: member.name } }] },
      '직책': { rich_text: [{ text: { content: member.position } }] },
      '소속': { rich_text: [{ text: { content: member.department } }] },
      '역할': { select: { name: member.role } },
      'PIN': { rich_text: [{ text: { content: member.pinHash } }] },
    },
  })
  return { ...member, id: page.id }
}

export async function updateMember(memberId: string, member: Partial<Omit<Member, 'id'>>): Promise<void> {
  const notion = await getNotion()
  const props: Record<string, unknown> = {}
  if (member.name !== undefined) props['이름'] = { title: [{ text: { content: member.name } }] }
  if (member.position !== undefined) props['직책'] = { rich_text: [{ text: { content: member.position } }] }
  if (member.department !== undefined) props['소속'] = { rich_text: [{ text: { content: member.department } }] }
  if (member.role !== undefined) props['역할'] = { select: { name: member.role } }
  if (member.pinHash !== undefined) props['PIN'] = { rich_text: [{ text: { content: member.pinHash } }] }
  await notion.pages.update({ page_id: memberId, properties: props as any })
}

export async function deleteMember(memberId: string): Promise<void> {
  const notion = await getNotion()
  await notion.pages.update({ page_id: memberId, archived: true })
}

// ─────────────────────────────────────────────
// 범례 관리
// ─────────────────────────────────────────────
export async function getLegends(legendsDbId: string): Promise<LegendItem[]> {
  const notion = await getNotion()
  const res = await notion.databases.query({ database_id: legendsDbId })
  return res.results.map((page: any) => ({
    id: page.id,
    label: page.properties['항목명']?.title?.[0]?.plain_text ?? '',
  }))
}

export async function createLegend(legendsDbId: string, label: string): Promise<LegendItem> {
  const notion = await getNotion()
  const page = await notion.pages.create({
    parent: { database_id: legendsDbId },
    properties: { '항목명': { title: [{ text: { content: label } }] } },
  })
  return { id: page.id, label }
}

export async function deleteLegend(legendId: string): Promise<void> {
  const notion = await getNotion()
  await notion.pages.update({ page_id: legendId, archived: true })
}

// ─────────────────────────────────────────────
// 일일보고 CRUD
// ─────────────────────────────────────────────
export async function getDailyReports(dailyDbId: string, authorName: string, weekStart?: string, weekEnd?: string): Promise<DailyReport[]> {
  const notion = await getNotion()
  await ensureCustomerNameColumn(dailyDbId, notion)
  const filters: any[] = [{ property: '작성자', rich_text: { equals: authorName } }]
  if (weekStart) filters.push({ property: '날짜', date: { on_or_after: weekStart } })
  if (weekEnd) filters.push({ property: '날짜', date: { on_or_before: weekEnd } })

  const res = await notion.databases.query({
    database_id: dailyDbId,
    filter: filters.length === 1 ? filters[0] : { and: filters },
    sorts: [{ property: '날짜', direction: 'descending' }],
  })

  return res.results.map((page: any) => ({
    id: page.id,
    date: page.properties['날짜']?.date?.start ?? '',
    authorName: page.properties['작성자']?.rich_text?.[0]?.plain_text ?? '',
    customerName: page.properties['고객사명']?.rich_text?.[0]?.plain_text ?? '',
    emotion: page.properties['감정']?.rich_text?.[0]?.plain_text ?? '',
    memorableEvent: page.properties['기억에 남는 일']?.rich_text?.[0]?.plain_text ?? '',
    hardThing: page.properties['힘들었던 점']?.rich_text?.[0]?.plain_text ?? '',
    dailyFeeling: page.properties['하루 느낀점']?.rich_text?.[0]?.plain_text ?? '',
  }))
}

export async function getDailyReport(pageId: string): Promise<DailyReport | null> {
  try {
    const notion = await getNotion()
    const page = await notion.pages.retrieve({ page_id: pageId }) as any
    return {
      id: page.id,
      date: page.properties['날짜']?.date?.start ?? '',
      authorName: page.properties['작성자']?.rich_text?.[0]?.plain_text ?? '',
      customerName: page.properties['고객사명']?.rich_text?.[0]?.plain_text ?? '',
      emotion: page.properties['감정']?.rich_text?.[0]?.plain_text ?? '',
      memorableEvent: page.properties['기억에 남는 일']?.rich_text?.[0]?.plain_text ?? '',
      hardThing: page.properties['힘들었던 점']?.rich_text?.[0]?.plain_text ?? '',
      dailyFeeling: page.properties['하루 느낀점']?.rich_text?.[0]?.plain_text ?? '',
    }
  } catch { return null }
}

export async function createDailyReport(dailyDbId: string, report: DailyReport): Promise<string> {
  const notion = await getNotion()
  const page = await notion.pages.create({
    parent: { database_id: dailyDbId },
    properties: {
      '제목': { title: [{ text: { content: `${report.authorName} - ${report.date} 일일보고` } }] },
      '날짜': { date: { start: report.date } },
      '작성자': { rich_text: [{ text: { content: report.authorName } }] },
      '감정': { rich_text: [{ text: { content: report.emotion } }] },
      '기억에 남는 일': { rich_text: [{ text: { content: report.memorableEvent } }] },
      '힘들었던 점': { rich_text: [{ text: { content: report.hardThing } }] },
      '하루 느낀점': { rich_text: [{ text: { content: report.dailyFeeling } }] },
      '고객사명': { rich_text: [{ text: { content: report.customerName || '' } }] },
    },
  })
  return page.id
}

export async function updateDailyReport(pageId: string, report: Partial<DailyReport>): Promise<void> {
  const notion = await getNotion()
  const props: Record<string, unknown> = {}
  if (report.emotion !== undefined) props['감정'] = { rich_text: [{ text: { content: report.emotion } }] }
  if (report.memorableEvent !== undefined) props['기억에 남는 일'] = { rich_text: [{ text: { content: report.memorableEvent } }] }
  if (report.hardThing !== undefined) props['힘들었던 점'] = { rich_text: [{ text: { content: report.hardThing } }] }
  if (report.dailyFeeling !== undefined) props['하루 느낀점'] = { rich_text: [{ text: { content: report.dailyFeeling } }] }
  if (report.customerName !== undefined) props['고객사명'] = { rich_text: [{ text: { content: report.customerName } }] }
  await notion.pages.update({ page_id: pageId, properties: props as any })
}

// ─────────────────────────────────────────────
// 주간보고 초안 저장/로드 및 Notion 내보내기
// ─────────────────────────────────────────────

export async function saveWeeklyDraft(draft: WeeklyDraft, member: Member, weeklyDbId?: string): Promise<string> {
  const notion = await getNotion()
  const dbId = weeklyDbId || process.env.NOTION_WEEKLY_DB_ID!
  const existing = await findExistingWeeklyPage(draft.weekStart, draft.weekEnd, member.name, dbId, notion)

  const metaJson = JSON.stringify({ __type: 'weekly_draft', ...draft })

  if (existing) {
    const blocks = await notion.blocks.children.list({ block_id: existing })
    for (const block of blocks.results as any[]) {
      if (block.type === 'code') {
        try {
          const json = block.code.rich_text.map((t: any) => t.plain_text).join('')
          const parsed = JSON.parse(json)
          if (parsed.__type === 'weekly_draft') {
            await notion.blocks.update({
              block_id: block.id,
              code: { rich_text: [{ type: 'text', text: { content: metaJson } }], language: 'json' },
            } as any)
            return existing
          }
        } catch {}
      }
    }
    await notion.blocks.children.append({
      block_id: existing,
      children: [{ type: 'code', code: { language: 'json', rich_text: [{ type: 'text', text: { content: metaJson } }] } } as any],
    })
    return existing
  }

  const weekTitle = buildWeeklyTitle(new Date(draft.weekStart))
  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      '주간보고서 (클릭)': { title: [{ text: { content: weekTitle } }] },
      '보고 기간': { date: { start: draft.weekStart, end: draft.weekEnd } },
      '작성자': { rich_text: [{ text: { content: member.name } }] },
      '작성 일자': { date: { start: new Date().toISOString().split('T')[0] } },
    },
    children: [{ type: 'code', code: { language: 'json', rich_text: [{ type: 'text', text: { content: metaJson } }] } } as any],
  })
  return page.id
}

export async function loadWeeklyDraft(weekStart: string, weekEnd: string, authorName: string, weeklyDbId?: string): Promise<WeeklyDraft | null> {
  const notion = await getNotion()
  const dbId = weeklyDbId || process.env.NOTION_WEEKLY_DB_ID!
  const pageId = await findExistingWeeklyPage(weekStart, weekEnd, authorName, dbId, notion)
  if (!pageId) return null

  try {
    const blocks = await notion.blocks.children.list({ block_id: pageId })
    for (const block of blocks.results as any[]) {
      if (block.type === 'code') {
        const json = block.code.rich_text.map((t: any) => t.plain_text).join('')
        const parsed = JSON.parse(json)
        if (parsed.__type === 'weekly_draft') return parsed as WeeklyDraft
      }
    }
  } catch {}
  return null
}

export async function exportWeeklyToNotion(draft: WeeklyDraft, settings: AppSettings, member: Member): Promise<string> {
  const notion = await getNotion()
  const authorLabel = `${settings.divisionName} > ${settings.teamName} > ${member.name} ${member.position}`
  const weekTitle = buildWeeklyTitle(new Date(draft.weekStart))

  const s1Blocks = buildS1(draft.section1)
  const s2Blocks = buildS2(draft.section2)
  const s3Blocks = buildS3(draft.section3, member)
  const s4Blocks = buildS4(draft.section4)
  const s5Blocks = buildS5(draft.section5)
  const s6Blocks = buildS6(draft.section6)

  const bodyChildren: any[] = [
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: `1. ${settings.teamName} 주요 업무 진행 상황` } }] } },
    ...s1Blocks,
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '2. 주요 성과' } }] } },
    ...s2Blocks,
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '3. 고객사 지원 주요 내역' } }] } },
    ...s3Blocks,
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '4. 예정된 작업' } }] } },
    ...s4Blocks,
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '5. DEQ 진행 상황' } }] } },
    ...s5Blocks,
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '6. 팀에 대한 의견' } }] } },
    ...s6Blocks,
  ]

  const metaJson = JSON.stringify({ __type: 'weekly_draft', ...draft })
  const dbId = settings.weeklyDbId || process.env.NOTION_WEEKLY_DB_ID!

  const existing = await findExistingWeeklyPage(draft.weekStart, draft.weekEnd, member.name, dbId, notion)

  if (existing) {
    const blocks = await notion.blocks.children.list({ block_id: existing })
    for (const block of blocks.results as any[]) {
      await notion.blocks.update({ block_id: block.id, archived: true } as any)
    }
    await notion.blocks.children.append({
      block_id: existing,
      children: [
        { type: 'table_of_contents', table_of_contents: { color: 'gray' } },
        {
          type: 'heading_1',
          heading_1: { rich_text: [{ type: 'text', text: { content: authorLabel } }], is_toggleable: true, children: bodyChildren },
        } as any,
        { type: 'code', code: { language: 'json', rich_text: [{ type: 'text', text: { content: metaJson } }] } },
      ],
    })
    await notion.pages.update({
      page_id: existing,
      properties: {
        '주간보고서 (클릭)': { title: [{ text: { content: weekTitle } }] },
        '보고 기간': { date: { start: draft.weekStart, end: draft.weekEnd } },
        '작성 일자': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    })
    return existing
  }

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      '주간보고서 (클릭)': { title: [{ text: { content: weekTitle } }] },
      '보고 기간': { date: { start: draft.weekStart, end: draft.weekEnd } },
      '작성자': { rich_text: [{ text: { content: member.name } }] },
      '작성 일자': { date: { start: new Date().toISOString().split('T')[0] } },
    },
    children: [
      { type: 'table_of_contents', table_of_contents: { color: 'gray' } } as any,
      {
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: authorLabel } }], is_toggleable: true, children: bodyChildren },
      } as any,
      { type: 'code', code: { language: 'json', rich_text: [{ type: 'text', text: { content: metaJson } }] } } as any,
    ],
  })
  return page.id
}

async function findExistingWeeklyPage(weekStart: string, weekEnd: string, authorName: string, dbId: string, notion: Client): Promise<string | null> {
  try {
    const res = await notion.databases.query({
      database_id: dbId,
      filter: { and: [
        { property: '작성자', rich_text: { equals: authorName } },
        { property: '보고 기간', date: { on_or_after: weekStart } },
        { property: '보고 기간', date: { on_or_before: weekEnd } },
      ]},
    })
    return res.results.length > 0 ? res.results[0].id : null
  } catch { return null }
}

function buildWeeklyTitle(weekStart: Date): string {
  const month = weekStart.getMonth() + 1
  const weekOfMonth = Math.ceil((weekStart.getDate() - 1) / 7) + 1
  return `${month}월 ${weekOfMonth}주차 주간 보고`
}

// ─── 섹션 블록 빌더 ───
function buildS1(items: WeeklyDraft['section1']): any[] {
  if (!items.length) return [empty()]
  return items.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: item.projectName } }],
      color: 'default',
      children: item.content ? [{
        type: 'toggle',
        toggle: { rich_text: [{ type: 'text', text: { content: item.content } }], color: 'default', children: [] },
      }] : [],
    },
  }))
}

function buildS2(items: WeeklyDraft['section2']): any[] {
  if (!items.length) return [empty()]
  return items.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: item.achievementType } }],
      color: 'default',
      children: item.content ? [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: item.content } }], color: 'default' } }] : [],
    },
  }))
}

function buildS3(items: WeeklyDraft['section3'], member: Member): any[] {
  if (!items.length) return [empty()]
  const map = new Map<string, Map<string, string[]>>()
  for (const item of items) {
    if (!map.has(item.customerName)) map.set(item.customerName, new Map())
    const st = item.supportType || '기타'
    if (!map.get(item.customerName)!.has(st)) map.get(item.customerName)!.set(st, [])
    if (item.content) map.get(item.customerName)!.get(st)!.push(item.content)
  }

  return Array.from(map.entries()).map(([customer, supports]) => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: `${customer} - ${member.name} ${member.position}` } }],
      color: 'default',
      children: Array.from(supports.entries()).map(([type, contents]) => ({
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', text: { content: type } }],
          color: 'default',
          children: contents.map(c => ({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: c } }], color: 'default' } })),
        },
      })),
    },
  }))
}

function buildS4(items: string[]): any[] {
  if (!items.filter(Boolean).length) return [empty()]
  return items.filter(Boolean).map(content => ({
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [{ type: 'text', text: { content } }], color: 'default' },
  }))
}

function buildS5(items: WeeklyDraft['section5']): any[] {
  const valid = Array.isArray(items) ? items.filter(i => i.description) : []
  if (!valid.length) return [empty()]
  return valid.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [
        { type: 'text', text: { content: item.description } },
        ...(item.link ? [
          { type: 'text', text: { content: '  ' } },
          { type: 'text', text: { content: item.link, link: { url: item.link.startsWith('http') ? item.link : `https://${item.link}` } } },
        ] : []),
      ],
      color: 'default',
    },
  }))
}

function buildS6(opinion: string): any[] {
  if (!opinion) return [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }]
  return [{ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: opinion } }], color: 'default' } }]
}

function empty(): any {
  return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '없음' } }], color: 'default' } }
}
