import type { Slot } from './domain'

const SUBJECT_EMOJI: Array<[RegExp, string]> = [
  [/语文|阅读/, '📖'],
  [/数学/, '➗'],
  [/英语/, '🔤'],
  [/体育|体活/, '🏀'],
  [/道德|法治/, '⚖️'],
  [/科学/, '🔬'],
  [/音乐/, '🎵'],
  [/美术/, '🎨'],
  [/书法/, '🖌️'],
  [/心理|成长/, '🌱'],
]

export const PERIOD_TONES = ['orange', 'purple', 'orange', 'blue', 'green', 'indigo', 'rose', 'cyan']

export function courseEmoji(subject: string) {
  return SUBJECT_EMOJI.find(([pattern]) => pattern.test(subject))?.[1] ?? '📚'
}

/** A timetable without actual times must never display inferred example hours. */
export const COURSE_CLOCK_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export function courseTimeError(slot: Pick<Slot, 'startTime' | 'endTime'>): string {
  const start = slot.startTime || ''
  const end = slot.endTime || ''
  if (!start && !end) return ''
  if (!start || !end) return '请同时填写开始和结束时间，或全部留空'
  if (!COURSE_CLOCK_REGEX.test(start) || !COURSE_CLOCK_REGEX.test(end)) return '时间格式应为 HH:mm'
  if (end <= start) return '结束时间要晚于开始时间'
  return ''
}

export function courseTimeLabel(slot: Pick<Slot, 'startTime' | 'endTime'>): string {
  return slot.startTime && slot.endTime && !courseTimeError(slot)
    ? `${slot.startTime} - ${slot.endTime}`
    : ''
}

export type CourseStatus = '已上课' | '待上课'

/** The displayed status is a time-based estimate, not a class attendance record. */
export function courseStatusAt(slot: Slot, date: Date, now = new Date()): CourseStatus | null {
  if (!courseTimeLabel(slot)) return null
  const [hour, minute] = slot.endTime!.split(':').map(Number)
  const classEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
  return now.getTime() >= classEnd.getTime() ? '已上课' : '待上课'
}

export function periodTone(period: number) {
  return PERIOD_TONES[(period - 1) % PERIOD_TONES.length]
}
