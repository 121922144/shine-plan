import { getRuntimeEnv } from '@/db'
import { json } from '@/lib/server/device'

export async function GET() {
  const env = getRuntimeEnv()
  return json({
    pushAvailable: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT),
    vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
  })
}
