const CACHE = 'bag-plan-v14'
const APP_SHELL = ['/', '/manifest.webmanifest', '/pwa-192x192.png', '/apple-touch-icon-180x180.png', '/backpack-mascot.png', '/home-hero-decorations.png?v=20260904-2']
const IS_LOCAL_DEVELOPMENT = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname) && self.location.port === '5190'

if (IS_LOCAL_DEVELOPMENT) {
  self.addEventListener('install', () => self.skipWaiting())
  self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
      const windows = await self.clients.matchAll({ type: 'window' })
      await self.registration.unregister()
      await Promise.all(windows.map((client) => 'navigate' in client ? client.navigate(client.url) : undefined))
    })())
  })
} else {

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url)))))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
    await self.clients.claim()
  })())
})

async function updateCache(cache, request, preloadResponse) {
  const response = preloadResponse || await fetch(request)
  if (response?.ok) await cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request) || await cache.match('/')
      const network = updateCache(cache, request, await event.preloadResponse)
      if (cached) {
        event.waitUntil(network.catch(() => undefined))
        return cached
      }
      return network
    })())
    return
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(request)
    const network = updateCache(cache, request)
    if (cached) {
      event.waitUntil(network.catch(() => undefined))
      return cached
    }
    return network
  })())
})

self.addEventListener('push', (event) => {
  let payload = { title: '明天的课程提醒', body: '打开闪闪计划查看明天课程', url: '/' }
  try { payload = { ...payload, ...event.data.json() } } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'bag-plan-reminder',
    data: { url: payload.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin))
    if (existing) return existing.focus().then(() => existing.navigate(target))
    return self.clients.openWindow(target)
  }))
})
}
