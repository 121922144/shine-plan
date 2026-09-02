import { getRuntimeEnv } from '@/db'
import { json } from '@/lib/server/device'

export async function GET() {
  const env = getRuntimeEnv()
  return json({ pushAvailable: Boolean(env.VAPID_PUBLIC_KEY), vapidPublicKey: env.VAPID_PUBLIC_KEY || '' })
}
