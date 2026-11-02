/* Loaded by Workbox's generated service worker. Keep this file dependency-free. */
self.addEventListener('push', event => {
  let message = {}
  try { message = event.data ? event.data.json() : {} } catch { message = { body: event.data?.text() ?? '' } }
  const title = typeof message.title === 'string' ? message.title : 'Full China'
  const options = {
    body: typeof message.body === 'string' ? message.body : 'Tienes una novedad en Full China.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof message.tag === 'string' ? message.tag : undefined,
    data: { url: typeof message.url === 'string' ? message.url : '/inicio' },
    renotify: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url || '/inicio', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus()
        if ('navigate' in client) await client.navigate(destination)
        return
      }
    }
    await self.clients.openWindow(destination)
  })())
})
