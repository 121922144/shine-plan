import { z } from 'zod'
import { dbQuery } from '@/db'
import { json, requireDevice } from '@/lib/server/device'
import { sendWebPush } from '@/lib/server/push'

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(20), auth: z.string().min(8) }),
})

export async function POST(request: Request) {
  const device = await requireDevice(request)
  if (!device) return json({ error: '设备凭证无效' }, { status: 401 })
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: '推送订阅格式不正确' }, { status: 400 })
  const subscription = parsed.data
  await dbQuery(`INSERT INTO push_subscriptions
    (id, device_id, endpoint, p256dh, auth, created_at, failure_count)
    VALUES ($1, $2, $3, $4, $5, $6, 0)
    ON CONFLICT (endpoint) DO UPDATE SET device_id = EXCLUDED.device_id,
      p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, failure_count = 0`, [
    crypto.randomUUID(), device.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, Date.now(),
  ])
  const response = await sendWebPush(
    { endpoint: subscription.endpoint, expirationTime: subscription.expirationTime ?? null, keys: subscription.keys },
    { title: '闪闪计划提醒已开启', body: '以后会按时提醒你第二天的课程和临时备注。', url: '/', tag: 'bag-plan-enabled' },
  )
  if (!response.ok) return json({ error: '订阅已保存，但测试通知发送失败' }, { status: 502 })
  await dbQuery('UPDATE push_subscriptions SET last_success_at = $1 WHERE endpoint = $2', [Date.now(), subscription.endpoint])
  return json({ subscribed: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const device = await requireDevice(request)
  if (!device) return json({ error: '设备凭证无效' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { endpoint?: string }
  if (body.endpoint) {
    await dbQuery('DELETE FROM push_subscriptions WHERE device_id = $1 AND endpoint = $2', [device.id, body.endpoint])
  } else {
    await dbQuery('DELETE FROM push_subscriptions WHERE device_id = $1', [device.id])
  }
  return json({ subscribed: false })
}
