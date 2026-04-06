import { Client } from '@notionhq/client'
import type {
  Member, LegendItem, AppSettings, DailyReport, WorkItem, DeqStatus,
  WeeklyReport, WeeklySection1Item, WeeklySection2Item, WeeklySection3Customer
} from '@/types'

const notion = new Client({ auth: process.env.NOTION_TOKEN })

const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID!
const WEEKLY_DB_ID = process.env.NOTION_WEEKLY_DB_ID!

// ─────────────────────────────────────────────
// 설정 DB 초기화 (앱 최초 실행 시)
// ─────────────────────────────────────────────
export async function initializeAppDatabases(): Promise<AppSettings> {
  // 이미 설정이 있는지 확인 (설정 페이지 조회)
  const existing = await getAppSettings()
  if (existing) return existing

  // 일일보고 DB 생성
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
      '매핑 여부': { checkbox: {} },
    },
  })

  // 팀원 DB 생성
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

  // 범례 DB 생성
  const legendsDb = await notion.databases.create({
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: '지원 범례 설정' } }],
    properties: {
      '항목명': { title: {} },
    },
  })

  // 기본 범례 추가
  const defaultLegends = ['DB 점검', '장애 대응', '컨설팅 지원', 'PoC 지원', '설치/구축']
  for (const label of defaultLegends) {
    await notion.pages.create({
      parent: { database_id: legendsDb.id },
      properties: { '항목명': { title: [{ text: { content: label } }] } },
    })
  }

  // 앱 설정 저장 (부모 페이지의 코드 블록에 저장)
  const settings: AppSettings = {
    dailyDbId: dailyDb.id,
    membersDbId: membersDb.id,
    legendsDbId: legendsDb.id,
    teamName: '통합기술연구3팀',
    divisionName: '통합기술본부',
  }

  await notion.pages.create({
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    properties: { title: [{ text: { content: '앱 설정 (수정하지 마세요)' } }] },
    children: [{
      type: 'code',
      code: {
        language: 'json',
        rich_text: [{ type: 'text', text: { content: JSON.stringify(settings, null, 2) } }],
      },
    }],
  })

  return settings
}

export async function getAppSettings(): Promise<AppSettings | null> {
  try {
    const blocks = await notion.blocks.children.list({ block_id: PARENT_PAGE_ID, page_size: 50 })
    for (const block of blocks.results) {
      if (block.object !== 'block') continue
      if ('type' in block && block.type === 'child_page') {
        const page = block as { type: 'child_page'; child_page: { title: string }; id: string }
        if (page.child_page.title === '앱 설정 (수정하지 마세요)') {
          const children = await notion.blocks.children.list({ block_id: page.id })
          for (const child of children.results) {
            if (child.object !== 'block') continue
            if ('type' in child && child.type === 'code') {
              const codeBlock = child as { type: 'code'; code: { rich_text: Array<{ plain_text: string }> } }
              const json = codeBlock.code.rich_text.map(t => t.plain_text).join('')
              return JSON.parse(json) as AppSettings
            }
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// 팀원 관리
// ─────────────────────────────────────────────
export async function getMembers(membersDbId: string): Promise<Member[]> {
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
  const props: Record<string, unknown> = {}
  if (member.name !== undefined) props['이름'] = { title: [{ text: { content: member.name } }] }
  if (member.position !== undefined) props['직책'] = { rich_text: [{ text: { content: member.position } }] }
  if (member.department !== undefined) props['소속'] = { rich_text: [{ text: { content: member.department } }] }
  if (member.role !== undefined) props['역할'] = { select: { name: member.role } }
  if (member.pinHash !== undefined) props['PIN'] = { rich_text: [{ text: { content: member.pinHash } }] }
  await notion.pages.update({ page_id: memberId, properties: props as any })
}

export async function deleteMember(memberId: string): Promise<void> {
  await notion.pages.update({ page_id: memberId, archived: true })
}

// ─────────────────────────────────────────────
// 범례 관리
// ─────────────────────────────────────────────
export async function getLegends(legendsDbId: string): Promise<LegendItem[]> {
  const res = await notion.databases.query({ database_id: legendsDbId })
  return res.results.map((page: any) => ({
    id: page.id,
    label: page.properties['항목명']?.title?.[0]?.plain_text ?? '',
  }))
}

export async function createLegend(legendsDbId: string, label: string): Promise<LegendItem> {
  const page = await notion.pages.create({
    parent: { database_id: legendsDbId },
    properties: { '항목명': { title: [{ text: { content: label } }] } },
  })
  return { id: page.id, label }
}

export async function deleteLegend(legendId: string): Promise<void> {
  await notion.pages.update({ page_id: legendId, archived: true })
}

// ─────────────────────────────────────────────
// 일일보고
// ─────────────────────────────────────────────
export async function getDailyReports(dailyDbId: string, authorName: string, weekStart?: string, weekEnd?: string): Promise<DailyReport[]> {
  const filters: any[] = [
    { property: '작성자', rich_text: { equals: authorName } },
  ]
  if (weekStart && weekEnd) {
    filters.push({ property: '날짜', date: { on_or_after: weekStart } })
    filters.push({ property: '날짜', date: { on_or_before: weekEnd } })
  }
  const res = await notion.databases.query({
    database_id: dailyDbId,
    filter: filters.length === 1 ? filters[0] : { and: filters },
    sorts: [{ property: '날짜', direction: 'descending' }],
  })

  const reports: DailyReport[] = []
  for (const page of res.results as any[]) {
    const children = await notion.blocks.children.list({ block_id: page.id })
    const workItems = parseWorkItemsFromBlocks(children.results)
    reports.push({
      id: page.id,
      date: page.properties['날짜']?.date?.start ?? '',
      authorName: page.properties['작성자']?.rich_text?.[0]?.plain_text ?? '',
      emotion: page.properties['감정']?.rich_text?.[0]?.plain_text ?? '',
      memorableEvent: page.properties['기억에 남는 일']?.rich_text?.[0]?.plain_text ?? '',
      hardThing: page.properties['힘들었던 점']?.rich_text?.[0]?.plain_text ?? '',
      dailyFeeling: page.properties['하루 느낀점']?.rich_text?.[0]?.plain_text ?? '',
      workItems,
    })
  }
  return reports
}

export async function getDailyReport(pageId: string): Promise<DailyReport | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId }) as any
    const children = await notion.blocks.children.list({ block_id: pageId })
    const workItems = parseWorkItemsFromBlocks(children.results)
    return {
      id: page.id,
      date: page.properties['날짜']?.date?.start ?? '',
      authorName: page.properties['작성자']?.rich_text?.[0]?.plain_text ?? '',
      emotion: page.properties['감정']?.rich_text?.[0]?.plain_text ?? '',
      memorableEvent: page.properties['기억에 남는 일']?.rich_text?.[0]?.plain_text ?? '',
      hardThing: page.properties['힘들었던 점']?.rich_text?.[0]?.plain_text ?? '',
      dailyFeeling: page.properties['하루 느낀점']?.rich_text?.[0]?.plain_text ?? '',
      workItems,
    }
  } catch {
    return null
  }
}

function parseWorkItemsFromBlocks(blocks: any[]): WorkItem[] {
  const items: WorkItem[] = []
  for (const block of blocks) {
    if (block.type !== 'code') continue
    try {
      const json = block.code.rich_text.map((t: any) => t.plain_text).join('')
      const parsed = JSON.parse(json)
      if (parsed.__type === 'work_items') {
        items.push(...(parsed.items as WorkItem[]))
      }
    } catch {}
  }
  return items
}

export async function createDailyReport(dailyDbId: string, report: DailyReport): Promise<string> {
  const title = `${report.authorName} - ${report.date} 일일보고`
  const page = await notion.pages.create({
    parent: { database_id: dailyDbId },
    properties: {
      '제목': { title: [{ text: { content: title } }] },
      '날짜': { date: { start: report.date } },
      '작성자': { rich_text: [{ text: { content: report.authorName } }] },
      '감정': { rich_text: [{ text: { content: report.emotion } }] },
      '기억에 남는 일': { rich_text: [{ text: { content: report.memorableEvent } }] },
      '힘들었던 점': { rich_text: [{ text: { content: report.hardThing } }] },
      '하루 느낀점': { rich_text: [{ text: { content: report.dailyFeeling } }] },
      '매핑 여부': { checkbox: false },
    },
    children: [
      {
        type: 'code',
        code: {
          language: 'json',
          rich_text: [{ type: 'text', text: { content: JSON.stringify({ __type: 'work_items', items: report.workItems }, null, 2) } }],
        },
      } as any,
    ],
  })
  return page.id
}

export async function updateDailyReport(pageId: string, report: Partial<DailyReport>): Promise<void> {
  const props: Record<string, unknown> = {}
  if (report.emotion !== undefined) props['감정'] = { rich_text: [{ text: { content: report.emotion } }] }
  if (report.memorableEvent !== undefined) props['기억에 남는 일'] = { rich_text: [{ text: { content: report.memorableEvent } }] }
  if (report.hardThing !== undefined) props['힘들었던 점'] = { rich_text: [{ text: { content: report.hardThing } }] }
  if (report.dailyFeeling !== undefined) props['하루 느낀점'] = { rich_text: [{ text: { content: report.dailyFeeling } }] }

  await notion.pages.update({ page_id: pageId, properties: props as any })

  if (report.workItems !== undefined) {
    // 기존 코드 블록 제거 후 재생성
    const children = await notion.blocks.children.list({ block_id: pageId })
    for (const block of children.results as any[]) {
      if (block.type === 'code') {
        await notion.blocks.update({ block_id: block.id, archived: true } as any)
      }
    }
    await notion.blocks.children.append({
      block_id: pageId,
      children: [{
        type: 'code',
        code: {
          language: 'json',
          rich_text: [{ type: 'text', text: { content: JSON.stringify({ __type: 'work_items', items: report.workItems }, null, 2) } }],
        },
      } as any],
    })
  }
}

// ─────────────────────────────────────────────
// 주간보고 Notion 내보내기
// ─────────────────────────────────────────────
export async function exportWeeklyReportToNotion(
  report: WeeklyReport,
  settings: AppSettings,
  member: Member
): Promise<string> {
  const authorLabel = `${settings.divisionName} > ${settings.teamName} > ${member.name} ${member.position}`

  // 기존 주간보고 조회 (이미 있으면 업데이트)
  const existingPageId = await findExistingWeeklyPage(report.weekStart, report.weekEnd, member.name)

  const section1Blocks = buildSection1Blocks(report.section1)
  const section2Blocks = buildSection2Blocks(report.section2)
  const section3Blocks = buildSection3Blocks(report.section3, member)
  const section4Blocks = buildSection4Blocks(report.section4)
  const section5Blocks = buildSection5Blocks(report.section5)
  const section6Blocks = buildSection6Blocks(report.section6)

  const bodyBlocks: any[] = [
    { type: 'table_of_contents', table_of_contents: { color: 'gray' } },
    {
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', text: { content: authorLabel } }],
        is_toggleable: true,
        color: 'default',
      },
      children: [
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: `1. ${settings.teamName} 주요 업무 진행 상황` } }], is_toggleable: false } },
        ...section1Blocks,
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '2. 주요 성과' } }], is_toggleable: false } },
        ...section2Blocks,
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '3. 고객사 지원 주요 내역' } }], is_toggleable: false } },
        ...section3Blocks,
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '4. 예정된 작업' } }], is_toggleable: false } },
        ...section4Blocks,
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '5. DEQ 진행 상황' } }], is_toggleable: false } },
        ...section5Blocks,
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '6. 팀에 대한 의견' } }], is_toggleable: false } },
        ...section6Blocks,
      ],
    },
  ]

  // 매핑된 날짜 목록 저장용 메타 블록
  const metaBlock: any = {
    type: 'code',
    code: {
      language: 'json',
      rich_text: [{ type: 'text', text: { content: JSON.stringify({ __type: 'weekly_meta', mappedDates: report.mappedDates }) } }],
    },
  }

  if (existingPageId) {
    // 기존 페이지 업데이트: 전체 블록 교체
    const existing = await notion.blocks.children.list({ block_id: existingPageId })
    for (const block of existing.results as any[]) {
      await notion.blocks.update({ block_id: block.id, archived: true } as any)
    }
    await notion.blocks.children.append({ block_id: existingPageId, children: [...bodyBlocks, metaBlock] })
    await notion.pages.update({
      page_id: existingPageId,
      properties: {
        '보고 기간': { date: { start: report.weekStart, end: report.weekEnd } },
        '작성 일자': { date: { start: report.createdDate } },
      },
    })
    return existingPageId
  } else {
    const page = await notion.pages.create({
      parent: { database_id: WEEKLY_DB_ID },
      properties: {
        '주간보고서 (클릭)': { title: [{ text: { content: report.title } }] },
        '보고 기간': { date: { start: report.weekStart, end: report.weekEnd } },
        '작성자': { rich_text: [{ text: { content: member.name } }] },
        '작성 일자': { date: { start: report.createdDate } },
      },
      children: [...bodyBlocks, metaBlock],
    })
    return page.id
  }
}

async function findExistingWeeklyPage(weekStart: string, weekEnd: string, authorName: string): Promise<string | null> {
  try {
    const res = await notion.databases.query({
      database_id: WEEKLY_DB_ID,
      filter: {
        and: [
          { property: '작성자', rich_text: { equals: authorName } },
          { property: '보고 기간', date: { on_or_after: weekStart } },
          { property: '보고 기간', date: { on_or_before: weekEnd } },
        ],
      },
    })
    if (res.results.length > 0) return res.results[0].id
    return null
  } catch {
    return null
  }
}

export async function getMappedDatesFromWeeklyPage(pageId: string): Promise<string[]> {
  try {
    const blocks = await notion.blocks.children.list({ block_id: pageId })
    for (const block of blocks.results as any[]) {
      if (block.type === 'code') {
        const json = block.code.rich_text.map((t: any) => t.plain_text).join('')
        const parsed = JSON.parse(json)
        if (parsed.__type === 'weekly_meta') return parsed.mappedDates as string[]
      }
    }
    return []
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────
// Notion 블록 빌더
// ─────────────────────────────────────────────
function buildSection1Blocks(items: WeeklySection1Item[]): any[] {
  if (items.length === 0) {
    return [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '없음' } }], color: 'default' } }]
  }
  return items.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: item.projectName } }],
      color: 'default',
      children: item.items.map(content => ({
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', text: { content } }],
          color: 'default',
          children: [],
        },
      })),
    },
  }))
}

function buildSection2Blocks(items: WeeklySection2Item[]): any[] {
  if (items.length === 0) {
    return [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '없음' } }], color: 'default' } }]
  }
  return items.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: item.type } }],
      color: 'default',
      children: item.items.map(content => ({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content } }], color: 'default' },
      })),
    },
  }))
}

function buildSection3Blocks(customers: WeeklySection3Customer[], member: Member): any[] {
  if (customers.length === 0) {
    return [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '없음' } }], color: 'default' } }]
  }
  return customers.map(customer => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: `${customer.customerName} - ${customer.authorName} ${member.position}` } }],
      color: 'default',
      children: customer.supportItems.map(support => ({
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', text: { content: support.supportType } }],
          color: 'default',
          children: support.items.map(content => ({
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: [{ type: 'text', text: { content } }], color: 'default' },
          })),
        },
      })),
    },
  }))
}

function buildSection4Blocks(items: string[]): any[] {
  if (items.length === 0) {
    return [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '없음' } }], color: 'default' } }]
  }
  return items.map(content => ({
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [{ type: 'text', text: { content } }], color: 'default' },
  }))
}

function buildSection5Blocks(deq?: DeqStatus): any[] {
  if (!deq) {
    return [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }]
  }
  return [
    {
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: `장기 미해결 일감 ${deq.longPending}건` } }],
        color: 'default',
      },
    },
    {
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: `우선순위 긴급 (+DSR) 진행 일감 ${deq.urgent}건` } }],
        color: 'default',
      },
    },
  ]
}

function buildSection6Blocks(opinion: string): any[] {
  if (!opinion) {
    return [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }]
  }
  return [
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: opinion } }],
        color: 'default',
      },
    },
  ]
}
