const CACHE = 'bag-plan-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/pwa-192x192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  event.respondWith(fetch(request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(request, copy))
    return response
  }).catch(() => caches.match(request).then((cached) => cached || caches.match('/'))))
})

self.addEventListener('push', (event) => {
  let payload = { title: '该收拾明天的书包啦', body: '打开书包计划查看明日清单', url: '/' }
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
