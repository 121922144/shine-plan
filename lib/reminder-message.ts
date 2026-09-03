export type ReminderSlot = { day: number; period: number; name: string }
export type ReminderNote = { date: string; text: string }

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function nextLocalDay(year: number, month: number, day: number) {
  const calendarDate = new Date(Date.UTC(year, month - 1, day + 1, 12))
  return { date: calendarDate.toISOString().slice(0, 10), weekday: calendarDate.getUTCDay() }
}

export function notificationBody(weekday: number, slots: ReminderSlot[], notes: ReminderNote[], targetDate: string) {
  const orderedSlots = [...slots].sort((left, right) => left.period - right.period)
  const dayNotes = notes.filter((note) => note.date === targetDate && note.text.trim()).map((note) => note.text.trim())
  const courseText = orderedSlots.length
    ? `明天${WEEKDAYS[weekday]}有 ${orderedSlots.length} 节课：${orderedSlots.map((slot) => slot.name).join('、')}。`
    : `明天${WEEKDAYS[weekday]}没有课程。`
  const noteText = dayNotes.length ? `另外记得：${dayNotes.join('、')}。` : ''
  const body = `${courseText}${noteText}`
  return body.length > 240 ? `${body.slice(0, 237)}…` : body
}
