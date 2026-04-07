// Notion 내보내기 전용 모듈 (데이터 저장은 Neon DB 사용)
import { Client } from '@notionhq/client'
import { getNotionConfig } from './notion-config'
import type { Member, AppSettings, WeeklyDraft } from '@/types'

async function getClient(settings: AppSettings, memberPageId?: string, memberToken?: string): Promise<{ notion: Client; parentPageId: string }> {
  // 토큰 우선순위: 개인 토큰 → 팀 DB 저장값 → 쿠키 → 환경변수
  const config = await getNotionConfig()
  const token = memberToken || settings.notionToken || config?.token || process.env.NOTION_TOKEN
  if (!token) throw new Error('Notion 토큰이 설정되지 않았습니다. 환경설정 → 내 정보에서 개인 Notion 토큰을 입력하거나, 팀장에게 팀 토큰 설정을 요청하세요.')
  // 페이지 ID 우선순위: 개인 페이지 ID → 팀 공용 페이지 ID → 쿠키
  const parentPageId = memberPageId || settings.notionParentPageId || config?.parentPageId || ''
  if (!parentPageId) throw new Error('Notion 페이지 ID가 설정되지 않았습니다. 환경설정 → 내 정보에서 개인 Notion 페이지 ID를 입력해주세요.')
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

// ── 블록 빌더 ──

function rt(content: string) {
  return [{ type: 'text', text: { content } }]
}

function h2Block(content: string): any {
  return { type: 'heading_2', heading_2: { rich_text: rt(content), is_toggleable: false, color: 'default' } }
}

function bulletBlock(content: string, children?: any[]): any {
  const b: any = { type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(content), color: 'default' } }
  if (children?.length) b.bulleted_list_item.children = children
  return b
}

function toggleBlock(content: string, children: any[]): any {
  return { type: 'toggle', toggle: { rich_text: rt(content), color: 'default', children } }
}

function calloutBlock(content: string, emoji = '💡'): any {
  return {
    type: 'callout',
    callout: { rich_text: rt(content), icon: { type: 'emoji', emoji }, color: 'gray_background' },
  }
}

function empty(): any {
  return bulletBlock('없음')
}

// ── 섹션 빌더 ──

function buildS1(items: WeeklyDraft['section1']): any[] {
  if (!items.length) return [empty()]
  return items.map(item => bulletBlock(item.projectName, item.content ? [bulletBlock(item.content)] : []))
}

function buildS2(items: WeeklyDraft['section2']): any[] {
  if (!items.length) return [empty()]
  return items.map(item => bulletBlock(item.achievementType, item.content ? [bulletBlock(item.content)] : []))
}

function buildS4(items: string[]): any[] {
  const valid = items.filter(Boolean)
  if (!valid.length) return [empty()]
  return valid.map(content => bulletBlock(content))
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
  return [{ type: 'paragraph', paragraph: { rich_text: rt(opinion), color: 'default' } }]
}

// ── 섹션3: 다단계 append로 toggle + callout 구조 생성 ──
// h1 → bullet(고객사) → toggle(지원종류) → callout(세부내역)
async function appendS3(notion: Client, h1Id: string, items: WeeklyDraft['section3'], member: Member) {
  const s3Map = new Map<string, Map<string, string[]>>()
  for (const item of items.filter(x => x.customerName)) {
    if (!s3Map.has(item.customerName)) s3Map.set(item.customerName, new Map())
    const st = item.supportType || '기타'
    if (!s3Map.get(item.customerName)!.has(st)) s3Map.get(item.customerName)!.set(st, [])
    if (item.content) s3Map.get(item.customerName)!.get(st)!.push(item.content)
  }

  if (s3Map.size === 0) {
    await notion.blocks.children.append({ block_id: h1Id, children: [empty()] })
    return
  }

  for (const [customer, supports] of s3Map) {
    // Step 1: 고객사 bullet 추가 (children 없이)
    const bulletRes = await (notion.blocks.children.append as any)({
      block_id: h1Id,
      children: [bulletBlock(customer)],
    })
    const bulletId = bulletRes.results[0].id

    // Step 2: 지원종류별 toggle (callout을 children으로 포함) 추가
    // toggle → callout 은 1단계 nesting → Notion API 허용
    const toggleBlocks: any[] = []
    for (const [supportType, contents] of supports) {
      const emoji = (supportType.includes('장애') || supportType.includes('이슈')) ? '🚫' : '💡'
      const callouts = contents.length > 0
        ? contents.map(c => calloutBlock(c, emoji))
        : [calloutBlock(supportType, emoji)]
      toggleBlocks.push(toggleBlock(supportType, callouts))
    }
    await notion.blocks.children.append({ block_id: bulletId, children: toggleBlocks })
  }
}

// ── 페이지 생성/업데이트 ──

async function upsertPage(
  notion: Client,
  parentPageId: string,
  pageTitle: string,
  draft: WeeklyDraft,
  settings: AppSettings,
  member: Member,
): Promise<string> {
  let pageId: string

  const existing = await findExistingPage(pageTitle, parentPageId, notion)
  if (existing) {
    // 기존 페이지의 모든 블록 삭제
    const blocks = await notion.blocks.children.list({ block_id: existing })
    for (const block of blocks.results) {
      await notion.blocks.update({ block_id: block.id, archived: true } as any)
    }
    pageId = existing
  } else {
    const page = await notion.pages.create({
      parent: { page_id: parentPageId } as any,
      properties: { title: [{ text: { content: pageTitle } }] } as any,
    })
    pageId = page.id
  }

  // TOC + h1 toggle 추가 (children 없이 — 이후 단계별 append)
  const authorLabel = `${settings.divisionName} > ${settings.teamName} > ${member.name} ${member.position}`
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      { type: 'table_of_contents', table_of_contents: { color: 'gray' } } as any,
      { type: 'heading_1', heading_1: { rich_text: rt(authorLabel), is_toggleable: true, color: 'default' } } as any,
    ],
  })

  // h1 블록 ID 가져오기
  const pageBlocks = await notion.blocks.children.list({ block_id: pageId })
  const h1Block = (pageBlocks as any).results.find((b: any) => b.type === 'heading_1')
  if (!h1Block) throw new Error('h1 블록을 찾을 수 없습니다.')
  const h1Id: string = h1Block.id

  // Batch 1: 섹션 1, 2 + 섹션3 heading
  await notion.blocks.children.append({
    block_id: h1Id,
    children: [
      h2Block(`1. ${settings.teamName} 주요 업무 진행 상황`),
      ...buildS1(draft.section1),
      h2Block('2. 주요 성과'),
      ...buildS2(draft.section2),
      h2Block('3. 고객사 지원 주요 내역'),
    ],
  })

  // 섹션3: 고객사별 다단계 append (toggle + callout)
  await appendS3(notion, h1Id, draft.section3, member)

  // Batch 2: 섹션 4, 5, 6
  await notion.blocks.children.append({
    block_id: h1Id,
    children: [
      h2Block('4. 예정된 작업'),
      ...buildS4(draft.section4),
      h2Block('5. DEQ 진행 상황'),
      ...buildS5(draft.section5),
      h2Block('6. 팀에 대한 의견'),
      ...buildS6(draft.section6),
    ],
  })

  return pageId
}

// ── 공개 API ──

export async function exportWeeklyToNotion(draft: WeeklyDraft, settings: AppSettings, member: Member): Promise<string> {
  const { notion, parentPageId } = await getClient(settings, member.notionPageId || undefined, member.notionToken || undefined)
  const pageTitle = buildPageTitle(draft.weekStart, member.name)
  return upsertPage(notion, parentPageId, pageTitle, draft, settings, member)
}

export async function exportAllMembersWeeklyToNotion(
  weekStart: string,
  membersData: Member[],
  draftsMap: Map<string, WeeklyDraft>,
  settings: AppSettings,
): Promise<{ name: string; pageId: string; error?: string }[]> {
  const { notion, parentPageId } = await getClient(settings)
  const results: { name: string; pageId: string; error?: string }[] = []
  for (const member of membersData) {
    const draft = draftsMap.get(member.name)
    if (!draft) { results.push({ name: member.name, pageId: '', error: '작성된 주간보고 없음' }); continue }
    try {
      // 개인 토큰/페이지 ID가 있으면 개인 클라이언트 사용
      const client = member.notionToken || member.notionPageId
        ? await getClient(settings, member.notionPageId || undefined, member.notionToken || undefined)
        : { notion, parentPageId }
      const pageTitle = buildPageTitle(weekStart, member.name)
      const pageId = await upsertPage(client.notion, client.parentPageId, pageTitle, draft, settings, member)
      results.push({ name: member.name, pageId })
    } catch (e: any) {
      results.push({ name: member.name, pageId: '', error: e.message || '내보내기 실패' })
    }
  }
  return results
}
