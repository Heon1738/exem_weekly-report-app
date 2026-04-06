import { format, startOfWeek, endOfWeek, getWeek, getMonth, getYear } from 'date-fns'
import { ko } from 'date-fns/locale'
import type {
  DailyReport, WeeklyReport,
  WeeklySection1Item, WeeklySection2Item, WeeklySection3Customer, DeqStatus
} from '@/types'

// 주간보고 제목 생성 (예: 4월 1주차 주간 보고)
export function buildWeeklyTitle(weekStart: Date): string {
  const month = getMonth(weekStart) + 1
  const weekOfMonth = Math.ceil((weekStart.getDate() - 1) / 7) + 1
  return `${month}월 ${weekOfMonth}주차 주간 보고`
}

// 해당 날짜의 주 시작(월)/끝(금) 반환
export function getWeekRange(date: Date): { weekStart: string; weekEnd: string } {
  const mon = startOfWeek(date, { weekStartsOn: 1 })
  const fri = endOfWeek(date, { weekStartsOn: 1 })
  // endOfWeek는 일요일이므로 금요일로 조정
  const friday = new Date(mon)
  friday.setDate(mon.getDate() + 4)
  return {
    weekStart: format(mon, 'yyyy-MM-dd'),
    weekEnd: format(friday, 'yyyy-MM-dd'),
  }
}

// 일일보고 목록 → 주간보고 생성
export function generateWeeklyReport(
  dailyReports: DailyReport[],
  existingMappedDates: string[],
  authorName: string
): WeeklyReport {
  const now = new Date()
  const allDates = dailyReports.map(r => r.date)
  const firstDate = allDates.sort()[0]
  const baseDate = firstDate ? new Date(firstDate) : now
  const { weekStart, weekEnd } = getWeekRange(baseDate)

  const title = buildWeeklyTitle(new Date(weekStart))

  // 새로 추가할 일일보고만 필터 (아직 매핑되지 않은 날짜)
  const newReports = dailyReports.filter(r => !existingMappedDates.includes(r.date))
  const allMappedDates = Array.from(new Set([...existingMappedDates, ...newReports.map(r => r.date)]))

  // Section 1: 프로젝트 업무
  const section1Map = new Map<string, Set<string>>()
  for (const report of newReports) {
    for (const item of report.workItems) {
      if (item.category === 'project' && item.projectName) {
        if (!section1Map.has(item.projectName)) section1Map.set(item.projectName, new Set())
        if (item.content) section1Map.get(item.projectName)!.add(item.content)
      }
    }
  }
  const section1: WeeklySection1Item[] = Array.from(section1Map.entries()).map(([projectName, items]) => ({
    projectName,
    items: Array.from(items),
  }))

  // Section 2: 주요 성과
  const section2Map = new Map<string, Set<string>>()
  for (const report of newReports) {
    for (const item of report.workItems) {
      if (item.category === 'achievement' && item.achievementType) {
        if (!section2Map.has(item.achievementType)) section2Map.set(item.achievementType, new Set())
        if (item.content) section2Map.get(item.achievementType)!.add(item.content)
      }
    }
  }
  const section2: WeeklySection2Item[] = Array.from(section2Map.entries()).map(([type, items]) => ({
    type,
    items: Array.from(items),
  }))

  // Section 3: 고객사 지원 주요 내역
  // Map: customerName → supportType → content[]
  const section3Map = new Map<string, Map<string, Set<string>>>()
  for (const report of newReports) {
    for (const item of report.workItems) {
      if (item.category === 'customer_support' && item.customerName) {
        if (!section3Map.has(item.customerName)) section3Map.set(item.customerName, new Map())
        const supportType = item.supportType || '기타'
        if (!section3Map.get(item.customerName)!.has(supportType)) {
          section3Map.get(item.customerName)!.set(supportType, new Set())
        }
        if (item.content) section3Map.get(item.customerName)!.get(supportType)!.add(item.content)
      }
    }
  }
  const section3: WeeklySection3Customer[] = Array.from(section3Map.entries()).map(([customerName, supportMap]) => ({
    customerName,
    authorName,
    supportItems: Array.from(supportMap.entries()).map(([supportType, items]) => ({
      supportType,
      items: Array.from(items),
    })),
  }))

  // Section 4: 예정된 작업
  const section4Set = new Set<string>()
  for (const report of newReports) {
    for (const item of report.workItems) {
      if (item.category === 'planned' && item.content) section4Set.add(item.content)
    }
  }
  const section4 = Array.from(section4Set)

  // Section 5: DEQ
  let section5: DeqStatus | undefined
  const deqReports = newReports.filter(r => r.deqStatus)
  if (deqReports.length > 0) {
    const last = deqReports[deqReports.length - 1]
    section5 = last.deqStatus
  }

  // Section 6: 팀에 대한 의견 (느낀점 + 명시적 의견 합산)
  const opinionParts: string[] = []
  for (const report of newReports) {
    for (const item of report.workItems) {
      if (item.category === 'opinion' && item.content) opinionParts.push(item.content)
    }
  }
  const section6 = opinionParts.join('\n')

  return {
    title,
    weekStart,
    weekEnd,
    authorName,
    createdDate: format(now, 'yyyy-MM-dd'),
    mappedDates: allMappedDates.sort(),
    section1,
    section2,
    section3,
    section4,
    section5,
    section6,
  }
}
