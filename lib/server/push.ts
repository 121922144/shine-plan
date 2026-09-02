import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import { getRuntimeEnv } from '@/db'

export async function sendWebPush(subscription: PushSubscription, data: Record<string, string>) {
  const env = getRuntimeEnv()
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error('推送服务尚未配置')
  }
  const payload = await buildPushPayload(
    { data, options: { ttl: 60 * 60 * 12, urgency: 'normal' } },
    subscription,
    { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT },
  )
  return fetch(subscription.endpoint, payload as unknown as RequestInit)
}
