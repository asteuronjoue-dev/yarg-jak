/* YARG server-delivered Web Push opt-in. No signing key is stored in this script. */
(() => {
 'use strict';
 const URL='https://xbhfjzurytdknbqvksjq.supabase.co';
 const KEY='sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
 const supports=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window)&&window.isSecureContext;
 const client=window.supabase?.createClient(URL,KEY);
 function decodeKey(value){
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
 }
 async function auth(){
  if(!client)throw Error('Connexion Supabase indisponible.');
  const {data:{user},error}=await client.auth.getUser();
  if(error)throw error;
  if(!user||user.is_anonymous||user.app_metadata?.provider==='anonymous')throw Error('Connecte-toi à un compte Rockstar pour activer les notifications.');
  return user;
 }
 async function status(){
  if(!supports())return {supported:false,subscribed:false,permission:'unsupported'};
  const registration=await navigator.serviceWorker.getRegistration('./yarg-notifications-sw.js');
  const subscription=registration?await registration.pushManager.getSubscription():null;
  if(subscription){
    const {data:{user}}=await client.auth.getUser();
    if(user&&!user.is_anonymous){
      const {data:registered,error}=await client.rpc('yarg_push_is_registered',{p_endpoint:subscription.endpoint});
      if(error)throw error;
      if(!registered){
        // A shared browser may have an old subscription from a different account.
        await subscription.unsubscribe();
        return {supported:true,subscribed:false,permission:Notification.permission};
      }
    }
  }
  return {supported:true,subscribed:!!subscription,permission:Notification.permission};
 }
 async function enable(){
  if(!supports())throw Error('Web Push n’est pas disponible dans ce navigateur. Sur iPhone, ajoute le site à l’écran d’accueil et ouvre-le depuis son icône.');
  await auth();
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Notifications non autorisées dans les réglages du navigateur.');
  const {data:key,error:keyError}=await client.rpc('yarg_push_public_key');
  if(keyError||!key)throw Error('Clé de notification indisponible.');
  const registration=await navigator.serviceWorker.register('./yarg-notifications-sw.js');
  await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription){
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key)});
  }
  const {error}=await client.rpc('yarg_push_register',{p_subscription:subscription.toJSON()});
  if(error)throw error;
  return {supported:true,subscribed:true,permission:'granted'};
 }
 async function disable(){
  await auth();
  const registration=await navigator.serviceWorker.getRegistration('./yarg-notifications-sw.js');
  const subscription=registration?await registration.pushManager.getSubscription():null;
  if(subscription){
   const {error}=await client.rpc('yarg_push_unregister',{p_endpoint:subscription.endpoint});
   // Unsubscribe locally even if the server is temporarily unavailable.
   await subscription.unsubscribe();
   if(error)throw error;
  }
  return {supported:supports(),subscribed:false,permission:Notification.permission};
 }
 window.YargPush={enable,disable,status};
})();