import { z } from 'zod'
import { getD1 } from '@/db'
import { json, requireDevice } from '@/lib/server/device'

const stateSchema = z.object({
  slots: z.array(z.object({
    id: z.string().min(1).max(80),
    day: z.number().int().min(1).max(5),
    period: z.number().int().min(1).max(8),
    name: z.string().trim().min(1).max(30),
  })).max(80),
  books: z.record(z.string().min(1).max(30), z.array(z.string().trim().min(1).max(40)).max(20)),
  reminder: z.object({ enabled: z.boolean(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  timezone: z.string().min(1).max(80),
})

type StateRow = {
  slots_json: string
  books_json: string
  reminder_enabled: number
  reminder_time: string
  timezone: string
  last_sent: string
  updated_at: number
}

export async function GET(request: Request) {
  const device = await requireDevice(request)
  if (!device) return json({ error: '设备凭证无效' }, { status: 401 })
  const row = await getD1().prepare(`SELECT slots_json, books_json, reminder_enabled, reminder_time,
    timezone, last_sent, updated_at FROM device_states WHERE device_id = ?`).bind(device.id).first<StateRow>()
  if (!row) return json({ error: '未找到设备数据' }, { status: 404 })
  return json({
    hasState: row.updated_at > 0 && (row.slots_json !== '[]' || row.books_json !== '{}'),
    slots: JSON.parse(row.slots_json),
    books: JSON.parse(row.books_json),
    reminder: { enabled: Boolean(row.reminder_enabled), time: row.reminder_time, lastSent: row.last_sent },
    timezone: row.timezone,
    updatedAt: row.updated_at,
  })
}

export async function PUT(request: Request) {
  const device = await requireDevice(request)
  if (!device) return json({ error: '设备凭证无效' }, { status: 401 })
  const parsed = stateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: '课程数据格式不正确' }, { status: 400 })
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: parsed.data.timezone }).format() }
  catch { return json({ error: '时区无效' }, { status: 400 }) }
  const { slots, books, reminder, timezone } = parsed.data
  const now = Date.now()
  await getD1().prepare(`UPDATE device_states SET slots_json = ?, books_json = ?, reminder_enabled = ?,
    reminder_time = ?, timezone = ?, updated_at = ? WHERE device_id = ?`)
    .bind(JSON.stringify(slots), JSON.stringify(books), reminder.enabled ? 1 : 0, reminder.time, timezone, now, device.id).run()
  return json({ saved: true, updatedAt: now })
}
