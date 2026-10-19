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


/**
 * Timetable days are Monday–Friday. Copy only clock times across EXISTING
 * classes with the same period. Never overwrite names, add slots or touch
 * weekend dates. A source with no valid pair of times never clears targets.
 */
export function applyPeriodTimeToWeek(
  slots: Slot[],
  sourceDay: number,
  period: number,
  time: Pick<Slot, 'startTime' | 'endTime'>,
): { slots: Slot[]; affected: number } {
  if (sourceDay < 1 || sourceDay > 5 || !courseTimeLabel(time) ||
    !slots.some((slot) => slot.day === sourceDay && slot.period === period && slot.name.trim())) {
    return { slots, affected: 0 }
  }

  let affected = 0
  let changed = false
  const next = slots.map((slot) => {
    if (slot.day < 1 || slot.day > 5 || slot.period !== period || !slot.name.trim()) return slot
    if (slot.startTime === time.startTime && slot.endTime === time.endTime) return slot
    changed = true
    if (slot.day !== sourceDay) affected += 1
    return { ...slot, startTime: time.startTime, endTime: time.endTime }
  })
  return { slots: changed ? next : slots, affected }
}

/**
 * Apply each valid class time from a selected weekday to the matching period
 * on other weekdays. Blank source periods deliberately leave targets unchanged.
 */
export function applyDayTimesToWeek(
  slots: Slot[],
  sourceDay: number,
): { slots: Slot[]; affected: number; periods: number } {
  if (sourceDay < 1 || sourceDay > 5) return { slots, affected: 0, periods: 0 }
  const hoursByPeriod = new Map<number, Pick<Slot, 'startTime' | 'endTime'>>()
  for (const slot of slots) {
    if (slot.day === sourceDay && slot.name.trim() && courseTimeLabel(slot)) {
      hoursByPeriod.set(slot.period, { startTime: slot.startTime, endTime: slot.endTime })
    }
  }
  if (!hoursByPeriod.size) return { slots, affected: 0, periods: 0 }
  let affected = 0
  const next = slots.map((slot) => {
    if (slot.day < 1 || slot.day > 5 || slot.day === sourceDay || !slot.name.trim()) return slot
    const source = hoursByPeriod.get(slot.period)
    if (!source || (slot.startTime === source.startTime && slot.endTime === source.endTime)) return slot
    affected += 1
    return { ...slot, startTime: source.startTime, endTime: source.endTime }
  })
  return { slots: affected ? next : slots, affected, periods: hoursByPeriod.size }
}

export function periodTone(period: number) {
  return PERIOD_TONES[(period - 1) % PERIOD_TONES.length]
}
