import { z } from 'zod'
import { dbQuery } from '@/db'
import { json, requireDevice } from '@/lib/server/device'

const stateSchema = z.object({
  slots: z.array(z.object({
    id: z.string().min(1).max(80),
    day: z.number().int().min(1).max(5),
    period: z.number().int().min(1).max(8),
    name: z.string().trim().min(1).max(30),
  })).max(80),
  notes: z.array(z.object({
    id: z.string().min(1).max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    text: z.string().trim().min(1).max(80),
  })).max(500),
  reminder: z.object({ enabled: z.boolean(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  timezone: z.string().min(1).max(80),
})

type StateRow = {
  slots_json: string
  notes_json: string
  reminder_enabled: boolean
  reminder_time: string
  timezone: string
  last_sent: string
  updated_at: number
}

export async function GET(request: Request) {
  const device = await requireDevice(request)
  if (!device) return json({ error: '设备凭证无效' }, { status: 401 })
  const { rows } = await dbQuery<StateRow>(`SELECT slots_json, notes_json, reminder_enabled, reminder_time,
    timezone, last_sent, updated_at FROM device_states WHERE device_id = $1`, [device.id])
  const row = rows[0]
  if (!row) return json({ error: '未找到设备数据' }, { status: 404 })
  return json({
    hasState: row.updated_at > 0 && (row.slots_json !== '[]' || row.notes_json !== '[]'),
    slots: JSON.parse(row.slots_json),
    notes: JSON.parse(row.notes_json),
    reminder: { enabled: row.reminder_enabled, time: row.reminder_time, lastSent: row.last_sent },
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
  const { slots, notes, reminder, timezone } = parsed.data
  const now = Date.now()
  const { rowCount } = await dbQuery(`UPDATE device_states
    SET slots_json = $1, notes_json = $2, reminder_enabled = $3,
      reminder_time = $4, timezone = $5, updated_at = $6
    WHERE device_id = $7`, [
    JSON.stringify(slots), JSON.stringify(notes), reminder.enabled, reminder.time, timezone, now, device.id,
  ])
  if (!rowCount) return json({ error: '未找到设备数据' }, { status: 404 })
  return json({ saved: true, updatedAt: now })
}
