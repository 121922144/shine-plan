/**
 * Lightweight Cloudflare Cron → Vercel Preview dispatcher.
 *
 * No database or VAPID secrets are stored in Cloudflare.
 * The dispatch token is a Wrangler secret and is never printed.
 */
interface Env {
  SITE_DISPATCH_URL: string
  DISPATCH_SECRET: string
  // Optional: Vercel's Deployment Protection bypass for an authenticated Preview.
  // Set as a Cloudflare encrypted Worker Secret, never as a [vars] value.
  VERCEL_AUTOMATION_BYPASS_SECRET?: string
}

type DispatchSummary = {
  checked: number
  sent: number
  skipped: number
  failed: number
}

async function runDispatch(env: Env) {
  if (!env.SITE_DISPATCH_URL) throw new Error('SITE_DISPATCH_URL is missing')
  if (!env.DISPATCH_SECRET) throw new Error('DISPATCH_SECRET is missing')

  const url = new URL('/api/internal/reminders/dispatch', env.SITE_DISPATCH_URL)
  if (url.protocol !== 'https:') throw new Error('Dispatch URL must use HTTPS')

  // Reject redirect responses rather than forwarding the Authorization header.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.DISPATCH_SECRET}`,
      ...(env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? { 'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET }
        : {}),
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) {
    // HTTP codes are safe to log; never log response bodies or credentials.
    throw new Error(`Reminder dispatch rejected: HTTP ${response.status}`)
  }

  const summary = await response.json() as DispatchSummary
  if (![summary.checked, summary.sent, summary.skipped, summary.failed].every(Number.isInteger)) {
    throw new Error('Reminder dispatch returned an unexpected response')
  }
  console.log('[shine-plan-reminders]', {
    checked: summary.checked,
    sent: summary.sent,
    skipped: summary.skipped,
    failed: summary.failed,
  })
  if (summary.failed > 0) {
    throw new Error(`Reminder dispatch failed for ${summary.failed} device(s)`)
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDispatch(env))
  },
}
