interface Env {
  SITE_DISPATCH_URL: string
  DISPATCH_SECRET: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, context: ExecutionContext) {
    context.waitUntil(fetch(`${env.SITE_DISPATCH_URL.replace(/\/$/, '')}/api/internal/reminders/dispatch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.DISPATCH_SECRET}` },
    }).then((response) => {
      if (!response.ok) throw new Error(`Reminder dispatch failed: ${response.status}`)
    }))
  },
}
