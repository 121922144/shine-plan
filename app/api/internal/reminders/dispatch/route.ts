import { getD1, getRuntimeEnv } from '@/db'
import { json } from '@/lib/server/device'
import { sendWebPush } from '@/lib/server/push'

type ReminderRow = {
  device_id: string
  slots_json: string
  books_json: string
  reminder_time: string
  timezone: string
}

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string }
type Slot = { day: number; period: number; name: string }
type Books = Record<string, string[]>

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` }
}

function tomorrowWeekday(now: Date, timezone: string) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  return WEEKDAYS[short]
}

function notificationBody(slots: Slot[], books: Books) {
  if (!slots.length) return '明天没有课程，好好休息吧。'
  const subjects = Array.from(new Set(slots.sort((a, b) => a.period - b.period).map((slot) => slot.name)))
  const lines = subjects.map((subject) => {
    const items = books[subject]?.filter(Boolean) || []
    return items.length ? `${subject}：${items.join('、')}` : `${subject}：还没填写书本`
  })
  const text = lines.join('；')
  return text.length > 220 ? `${text.slice(0, 217)}…` : text
}

export async function POST(request: Request) {
  const env = getRuntimeEnv()
  const authorization = request.headers.get('authorization') || ''
  if (!env.DISPATCH_SECRET || authorization !== `Bearer ${env.DISPATCH_SECRET}`) {
    return json({ error: '无权执行提醒任务' }, { status: 401 })
  }

  const db = getD1()
  const now = new Date()
  const { results = [] } = await db.prepare(`SELECT device_id, slots_json, books_json, reminder_time, timezone
    FROM device_states WHERE reminder_enabled = 1`).all<ReminderRow>()
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of results) {
    try {
      const clock = localClock(now, row.timezone)
      if (clock.time < row.reminder_time) { skipped += 1; continue }
      const deliveryId = `${row.device_id}:${clock.date}`
      const reservation = await db.prepare(`INSERT OR IGNORE INTO reminder_deliveries
        (id, device_id, local_date, status) VALUES (?, ?, ?, 'sending')`)
        .bind(deliveryId, row.device_id, clock.date).run()
      if (!reservation.meta.changes) { skipped += 1; continue }

      const subscriptions = await db.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions
        WHERE device_id = ?`).bind(row.device_id).all<SubscriptionRow>()
      const slots = (JSON.parse(row.slots_json) as Slot[]).filter((slot) => slot.day === tomorrowWeekday(now, row.timezone))
      const body = notificationBody(slots, JSON.parse(row.books_json) as Books)
      let delivered = false

      for (const subscription of subscriptions.results || []) {
        try {
          const response = await sendWebPush(
            { endpoint: subscription.endpoint, expirationTime: null, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            { title: '该收拾明天的书包啦', body, url: '/', tag: `bag-plan-${clock.date}` },
          )
          if (response.ok) {
            delivered = true
            await db.prepare('UPDATE push_subscriptions SET last_success_at = ?, failure_count = 0 WHERE endpoint = ?')
              .bind(Date.now(), subscription.endpoint).run()
          } else if (response.status === 404 || response.status === 410) {
            await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(subscription.endpoint).run()
          } else {
            await db.prepare('UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = ?').bind(subscription.endpoint).run()
          }
        } catch {
          await db.prepare('UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = ?').bind(subscription.endpoint).run()
        }
      }

      if (delivered) {
        await db.batch([
          db.prepare(`UPDATE reminder_deliveries SET status = 'sent', sent_at = ? WHERE id = ?`).bind(Date.now(), deliveryId),
          db.prepare('UPDATE device_states SET last_sent = ? WHERE device_id = ?').bind(clock.date, row.device_id),
        ])
        sent += 1
      } else {
        await db.prepare('DELETE FROM reminder_deliveries WHERE id = ?').bind(deliveryId).run()
        failed += 1
      }
    } catch {
      failed += 1
    }
  }

  return json({ checked: results.length, sent, skipped, failed })
}
