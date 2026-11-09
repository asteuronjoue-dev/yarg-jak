/* YARG Web Push worker: records non-sensitive delivery diagnostics locally,
   even when the website is closed. */
const DIAGNOSTICS_CACHE='yarg-push-diagnostics-v1';
const DIAGNOSTICS_KEY=new URL('./yarg-push-diagnostics',self.registration.scope).href;
async function recordPushDiagnostics(result){
 try{
  const cache=await caches.open(DIAGNOSTICS_CACHE);
  await cache.put(DIAGNOSTICS_KEY,new Response(JSON.stringify(result),{
   headers:{'content-type':'application/json'}
  }));
 }catch(error){console.warn('Unable to record push diagnostics',error);}
}
async function getPushDiagnostics(){
 try{
  const cache=await caches.open(DIAGNOSTICS_CACHE);
  const response=await cache.match(DIAGNOSTICS_KEY);
  return response ? await response.json() : null;
 }catch{return null;}
}
self.addEventListener('install', event => {event.waitUntil(self.skipWaiting());});
self.addEventListener('activate', event => {event.waitUntil(self.clients.claim());});
self.addEventListener('message', event => {
 if(event.data?.type!=='YARG_PUSH_DIAGNOSTICS' || !event.ports?.[0])return;
 event.waitUntil((async()=>{
  const details=await getPushDiagnostics();
  event.ports[0].postMessage({type:'YARG_PUSH_DIAGNOSTICS',details});
 })());
});
self.addEventListener('push', event => {
 event.waitUntil((async()=>{
  const recordedAt=new Date().toISOString();
  let data={};
  try{data=event.data?event.data.json():{};}catch{
   await recordPushDiagnostics({receivedAt:recordedAt,outcome:'invalid_json'});
   return;
  }
  const kind=String(data.kind||'');
  if(!['band_invite','soon','next'].includes(kind)){
   await recordPushDiagnostics({receivedAt:recordedAt,outcome:'ignored_type',kind:kind.slice(0,50)});
   return;
  }
  const title=String(data.title||'Asteur On Joue');
  const body=String(data.body||'');
  const tag=String(data.tag||'yarg-'+kind);
  const target=new URL('./file.html',self.registration.scope).href;
  try{
   await self.registration.showNotification(title,{
    body,tag,icon:'./assets/favicon.png',badge:'./assets/favicon.png',
    data:{url:target,kind},renotify:kind==='next',
    requireInteraction:kind==='next'
   });
   await recordPushDiagnostics({receivedAt:recordedAt,outcome:'display_requested',kind});
  }catch(error){
   await recordPushDiagnostics({receivedAt:recordedAt,outcome:'display_error',kind,
    error:String(error?.message||error).slice(0,160)});
   throw error;
  }
 })());
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('./file.html',self.registration.scope).href;
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>client.url.split('#')[0].split('?')[0]===target);
  if(existing)return existing.focus();
  return clients.openWindow(target);
 })());
});
