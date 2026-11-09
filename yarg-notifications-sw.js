/* On-page song alerts for mobile browsers; not push notifications. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('./file.html', self.registration.scope).href;
    const windows = await clients.matchAll({type:'window', includeUncontrolled:true});
    const existing = windows.find(client => client.url.split('#')[0].split('?')[0] === target);
    if(existing) return existing.focus();
    return clients.openWindow(target);
  })());
});
