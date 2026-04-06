// Notion 내보내기 전용 모듈 (데이터 저장은 Neon DB 사용)
import { Client } from '@notionhq/client'
import { getNotionConfig } from './notion-config'
import type { Member, AppSettings, WeeklyDraft } from '@/types'

async function getNotion(): Promise<Client> {
  const config = await getNotionConfig()
  return new Client({ auth: config?.token || process.env.NOTION_TOKEN })
}

// Notion 주간보고 페이지를 정식 포맷으로 내보내기
export async function exportWeeklyToNotion(draft: WeeklyDraft, settings: AppSettings, member: Member): Promise<string> {
  const notion = await getNotion()
  const dbId = settings.notionExportDbId
  if (!dbId) throw new Error('Notion 내보내기 DB ID가 설정되지 않았습니다. 환경설정 → Notion 연동에서 설정해주세요.')

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
        { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: authorLabel } }], is_toggleable: true, children: bodyChildren } } as any,
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
      { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: authorLabel } }], is_toggleable: true, children: bodyChildren } } as any,
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

function buildS1(items: WeeklyDraft['section1']): any[] {
  if (!items.length) return [empty()]
  return items.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: item.projectName } }],
      color: 'default',
      children: item.content ? [{ type: 'toggle', toggle: { rich_text: [{ type: 'text', text: { content: item.content } }], color: 'default', children: [] } }] : [],
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
