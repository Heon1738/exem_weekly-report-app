// Notion 내보내기 전용 모듈 (데이터 저장은 Neon DB 사용)
import { Client } from '@notionhq/client'
import { getNotionConfig } from './notion-config'
import type { Member, AppSettings, WeeklyDraft } from '@/types'

async function getClient(settings: AppSettings): Promise<{ notion: Client; parentPageId: string }> {
  const config = await getNotionConfig()
  const token = config?.token || process.env.NOTION_TOKEN
  if (!token) throw new Error('Notion 토큰이 설정되지 않았습니다.')
  // Use settings parentPageId as primary; cookie parentPageId as fallback
  const parentPageId = settings.notionParentPageId || config?.parentPageId || ''
  if (!parentPageId) throw new Error('Notion 부모 페이지 ID가 설정되지 않았습니다. 환경설정 → Notion 연동에서 설정해주세요.')
  return { notion: new Client({ auth: token }), parentPageId }
}

function buildPageTitle(weekStart: string, memberName: string): string {
  const d = new Date(weekStart)
  const month = d.getMonth() + 1
  const weekOfMonth = Math.ceil((d.getDate() - 1) / 7) + 1
  return `${month}월 ${weekOfMonth}주차 주간보고 - ${memberName}`
}

async function findExistingPage(title: string, parentPageId: string, notion: Client): Promise<string | null> {
  try {
    const res = await notion.search({ query: title, filter: { property: 'object', value: 'page' }, page_size: 20 })
    const normalizedParent = parentPageId.replace(/-/g, '')
    const match = (res.results as any[]).find(p => {
      const pParent = (p.parent?.page_id || '').replace(/-/g, '')
      const titleArr = p.properties?.title?.title || []
      const pTitle = titleArr.map((t: any) => t.plain_text).join('')
      return pParent === normalizedParent && pTitle === title
    })
    return match?.id || null
  } catch { return null }
}

function buildBodyContent(draft: WeeklyDraft, settings: AppSettings, member: Member): any[] {
  const authorLabel = `${settings.divisionName} > ${settings.teamName} > ${member.name} ${member.position}`
  const bodyChildren: any[] = [
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: `1. ${settings.teamName} 주요 업무 진행 상황` } }] } },
    ...buildS1(draft.section1),
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '2. 주요 성과' } }] } },
    ...buildS2(draft.section2),
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '3. 고객사 지원 주요 내역' } }] } },
    ...buildS3(draft.section3, member),
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '4. 예정된 작업' } }] } },
    ...buildS4(draft.section4),
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '5. DEQ 진행 상황' } }] } },
    ...buildS5(draft.section5),
    { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '6. 팀에 대한 의견' } }] } },
    ...buildS6(draft.section6),
  ]
  return [
    { type: 'table_of_contents', table_of_contents: { color: 'gray' } } as any,
    { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: authorLabel } }], is_toggleable: true, children: bodyChildren } } as any,
  ]
}

async function upsertPage(notion: Client, parentPageId: string, pageTitle: string, bodyContent: any[]): Promise<string> {
  const existing = await findExistingPage(pageTitle, parentPageId, notion)
  if (existing) {
    const blocks = await notion.blocks.children.list({ block_id: existing })
    for (const block of blocks.results) {
      await notion.blocks.update({ block_id: block.id, archived: true } as any)
    }
    await notion.blocks.children.append({ block_id: existing, children: bodyContent })
    return existing
  }
  const page = await notion.pages.create({
    parent: { page_id: parentPageId } as any,
    properties: { title: [{ text: { content: pageTitle } }] } as any,
    children: bodyContent,
  })
  return page.id
}

export async function exportWeeklyToNotion(draft: WeeklyDraft, settings: AppSettings, member: Member): Promise<string> {
  const { notion, parentPageId } = await getClient(settings)
  const pageTitle = buildPageTitle(draft.weekStart, member.name)
  const bodyContent = buildBodyContent(draft, settings, member)
  return upsertPage(notion, parentPageId, pageTitle, bodyContent)
}

export async function exportAllMembersWeeklyToNotion(
  weekStart: string,
  membersData: Member[],
  draftsMap: Map<string, WeeklyDraft>,
  settings: AppSettings
): Promise<{ name: string; pageId: string; error?: string }[]> {
  const { notion, parentPageId } = await getClient(settings)
  const results: { name: string; pageId: string; error?: string }[] = []
  for (const member of membersData) {
    const draft = draftsMap.get(member.name)
    if (!draft) { results.push({ name: member.name, pageId: '', error: '작성된 주간보고 없음' }); continue }
    try {
      const pageTitle = buildPageTitle(weekStart, member.name)
      const bodyContent = buildBodyContent(draft, settings, member)
      const pageId = await upsertPage(notion, parentPageId, pageTitle, bodyContent)
      results.push({ name: member.name, pageId })
    } catch (e: any) {
      results.push({ name: member.name, pageId: '', error: e.message || '내보내기 실패' })
    }
  }
  return results
}

// ── Section builders ──

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
  return items.filter(Boolean).map(content => ({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content } }], color: 'default' } }))
}

function buildS5(items: WeeklyDraft['section5']): any[] {
  const valid = Array.isArray(items) ? items.filter(i => i.description) : []
  if (!valid.length) return [empty()]
  return valid.map(item => ({
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [
        { type: 'text', text: { content: item.description } },
        ...(item.link ? [{ type: 'text', text: { content: '  ' } }, { type: 'text', text: { content: item.link, link: { url: item.link.startsWith('http') ? item.link : `https://${item.link}` } } }] : []),
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
