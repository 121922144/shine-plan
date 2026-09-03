export type Slot = { id: string; day: number; period: number; name: string }
export type DateNote = { id: string; date: string; text: string }
export type ReminderSettings = { enabled: boolean; time: string; lastSent: string }
export type HomeDay = 'today' | 'tomorrow'

export const DAY_SWITCH_HOUR = 18
export const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function defaultHomeDay(now = new Date()): HomeDay {
  return now.getHours() >= DAY_SWITCH_HOUR ? 'tomorrow' : 'today'
}

export function localDateAtOffset(now: Date, offset: number) {
  const date = new Date(now.getTime())
  date.setDate(date.getDate() + offset)
  return date
}

export function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function homeTarget(now: Date, selected: HomeDay) {
  const date = localDateAtOffset(now, selected === 'tomorrow' ? 1 : 0)
  return {
    date,
    dateKey: localDateKey(date),
    weekday: date.getDay(),
    label: selected === 'today' ? '今天' : '明天',
    weekdayLabel: DAY_NAMES[date.getDay()],
  }
}
