import { getD1 } from '@/db'
import { json, randomToken, tokenHash } from '@/lib/server/device'

export async function POST() {
  const db = getD1()
  const id = crypto.randomUUID()
  const token = randomToken()
  const hash = await tokenHash(token)
  const now = Date.now()
  await db.batch([
    db.prepare('INSERT INTO devices (id, token_hash, created_at) VALUES (?, ?, ?)').bind(id, hash, now),
    db.prepare(`INSERT INTO device_states
      (device_id, slots_json, books_json, reminder_enabled, reminder_time, timezone, last_sent, updated_at)
      VALUES (?, '[]', '{}', 0, '20:00', 'Asia/Shanghai', '', 0)`)
      .bind(id),
  ])
  return json({ token }, { status: 201 })
}
