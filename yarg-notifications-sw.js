/* YARG background Web Push: receives server notifications when no site tab is open.
   Notification actions open the existing queue and banner interface. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  if(!['band_invite','soon','next'].includes(data.kind)) return;
  const title = String(data.title || 'Asteur On Joue');
  const body = String(data.body || '');
  const tag = String(data.tag || 'yarg-' + data.kind);
  const target = new URL('./file.html', self.registration.scope).href;
  event.waitUntil(self.registration.showNotification(title,{
    body,tag,icon:'./assets/favicon.png',badge:'./assets/favicon.png',
    data:{url:target,kind:data.kind},renotify:data.kind==='next',
    requireInteraction:data.kind==='next'
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('./file.html', self.registration.scope).href;
    const windows = await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = windows.find(client => client.url.split('#')[0].split('?')[0] === target);
    if(existing) return existing.focus();
    return clients.openWindow(target);
  })());
});