import { dbQuery } from '@/db'
import { json, randomToken, tokenHash } from '@/lib/server/device'

export async function POST() {
  const id = crypto.randomUUID()
  const token = randomToken()
  const hash = await tokenHash(token)
  const now = Date.now()
  // Create device + initial state in one atomic PostgreSQL statement.
  await dbQuery(`WITH created_device AS (
    INSERT INTO devices (id, token_hash, created_at)
    VALUES ($1, $2, $3) RETURNING id
  )
  INSERT INTO device_states
    (device_id, slots_json, notes_json, reminder_enabled, reminder_time, timezone, last_sent, updated_at)
  SELECT id, '[]', '[]', FALSE, '20:00', 'Asia/Shanghai', '', 0
  FROM created_device`, [id, hash, now])
  return json({ token }, { status: 201 })
}
