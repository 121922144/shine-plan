import { dbQuery, getRuntimeEnv } from '@/db'
import { json } from '@/lib/server/device'
import { sendWebPush } from '@/lib/server/push'
import { nextLocalDay, notificationBody, type ReminderNote, type ReminderSlot } from '@/lib/reminder-message'

type ReminderRow = {
  device_id: string
  slots_json: string
  notes_json: string
  reminder_time: string
  timezone: string
}
type SubscriptionRow = { endpoint: string; p256dh: string; auth: string }

function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  }
}

export async function POST(request: Request) {
  const env = getRuntimeEnv()
  const authorization = request.headers.get('authorization') || ''
  if (!env.DISPATCH_SECRET || authorization !== `Bearer ${env.DISPATCH_SECRET}`) {
    return json({ error: '无权执行提醒任务' }, { status: 401 })
  }

  const now = new Date()
  const { rows: results } = await dbQuery<ReminderRow>(`SELECT device_id, slots_json, notes_json, reminder_time, timezone
    FROM device_states WHERE reminder_enabled = TRUE`)
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of results) {
    try {
      const clock = localClock(now, row.timezone)
      if (clock.time < row.reminder_time) { skipped += 1; continue }

      const deliveryId = `${row.device_id}:${clock.date}`
      // Unique key prevents duplicate daily notifications when dispatch is retried.
      const { rowCount } = await dbQuery(`INSERT INTO reminder_deliveries
        (id, device_id, local_date, status)
        VALUES ($1, $2, $3, 'sending')
        ON CONFLICT (device_id, local_date) DO NOTHING
        RETURNING id`, [deliveryId, row.device_id, clock.date])
      if (!rowCount) { skipped += 1; continue }

      const { rows: subscriptions } = await dbQuery<SubscriptionRow>(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = $1',
        [row.device_id],
      )
      const tomorrow = nextLocalDay(clock.year, clock.month, clock.day)
      const slots = (JSON.parse(row.slots_json) as ReminderSlot[]).filter((slot) => slot.day === tomorrow.weekday)
      const body = notificationBody(tomorrow.weekday, slots, JSON.parse(row.notes_json) as ReminderNote[], tomorrow.date)
      let delivered = false

      for (const subscription of subscriptions) {
        try {
          const response = await sendWebPush(
            { endpoint: subscription.endpoint, expirationTime: null, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            { title: '明天的课程提醒', body, url: '/', tag: `bag-plan-${clock.date}` },
          )
          if (response.ok) {
            delivered = true
            await dbQuery(
              'UPDATE push_subscriptions SET last_success_at = $1, failure_count = 0 WHERE endpoint = $2',
              [Date.now(), subscription.endpoint],
            )
          } else if (response.status === 404 || response.status === 410) {
            await dbQuery('DELETE FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint])
          } else {
            await dbQuery('UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = $1', [subscription.endpoint])
          }
        } catch {
          await dbQuery('UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = $1', [subscription.endpoint])
        }
      }

      if (delivered) {
        await dbQuery(`UPDATE reminder_deliveries SET status = 'sent', sent_at = $1 WHERE id = $2`, [Date.now(), deliveryId])
        await dbQuery('UPDATE device_states SET last_sent = $1 WHERE device_id = $2', [clock.date, row.device_id])
        sent += 1
      } else {
        await dbQuery('DELETE FROM reminder_deliveries WHERE id = $1', [deliveryId])
        failed += 1
      }
    } catch {
      failed += 1
    }
  }

  return json({ checked: results.length, sent, skipped, failed })
}
