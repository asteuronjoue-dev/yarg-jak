/* Installed-app onboarding: browser permission first, Rockstar subscription on login.
   Guests can allow OS notifications, but targeted YARG push delivery requires a Rockstar profile.
   A native permission dialog is only requested after a genuine user click. */
(() => {
 'use strict';
 if(window.__yargPwaWelcomeLoaded)return;
 window.__yargPwaWelcomeLoaded=true;
 const installed=()=>Boolean(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);
 if(!installed()||!window.isSecureContext||!('Notification' in window))return;
 const KEY='yarg_pwa_notification_welcome_v1';
 const SECOND='yarg_pwa_notification_login_offer_v1';
 const SUPABASE_URL='https://xbhfjzurytdknbqvksjq.supabase.co';
 const SUPABASE_KEY='sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
 const supportsPush=()=>('serviceWorker' in navigator)&&('PushManager' in window);
 if(!supportsPush())return;
 const getStored=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
 const setStored=(key,val)=>{try{localStorage.setItem(key,val)}catch{}};
 let authClient=null;
 let currentUid=null;
 let initialUid=null;
 let firstOfferShown=false;
 let openDialog=null;
 let loader=null;
 let connecting=false;
 function profileUser(user){
  return user&&!user.is_anonymous&&user.app_metadata?.provider!=='anonymous'?user:null;
 }
 function loadPush(){
  if(window.YargPush)return Promise.resolve(window.YargPush);
  if(loader)return loader;
  loader=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='yarg-push.js';
   script.onload=()=>window.YargPush?resolve(window.YargPush):reject(Error('Module de notifications indisponible'));
   script.onerror=()=>reject(Error('Impossible de charger les notifications'));
   document.head.append(script);
  }).catch(error=>{loader=null;throw error});
  return loader;
 }
 async function connectRockstar(){
  if(connecting||!currentUid||Notification.permission!=='granted')return;
  connecting=true;
  try{
   const push=await loadPush();
   // Permission is already granted. This associates this device with the logged-in Rockstar.
   await push.enable();
   if(openDialog?.kind==='login'){
    openDialog.status.textContent='Notifications activées pour ton compte Rockstar !';
    closeOffer();
   }
  }catch(error){
   console.warn('Abonnement YARG après connexion :',error);
   if(openDialog?.kind==='login'){
    openDialog.status.textContent='Autorisation accordée, mais inscription au compte impossible pour le moment. Réessaie depuis Profil → Notifications.';
   }
  }finally{connecting=false}
 }
 function closeOffer(){
  if(!openDialog)return;
  openDialog.overlay.remove();
  openDialog=null;
 }
 function showOffer(kind){
  if(openDialog)return;
  if(kind==='first')firstOfferShown=true;
  const overlay=document.createElement('div');
  overlay.id='yarg-pwa-welcome';
  overlay.setAttribute('role','presentation');
  overlay.innerHTML=`<style>
  #yarg-pwa-welcome{position:fixed;inset:0;z-index:2147483000;background:#05080ddc;display:grid;place-items:center;padding:18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
  #yarg-pwa-welcome *{box-sizing:border-box}
  #yarg-pwa-welcome .yw-card{width:min(100%,440px);padding:23px;background:#16242b;border:2px solid #42cfbf;border-radius:19px;box-shadow:0 20px 75px #000c;color:#f4f8fc}
  #yarg-pwa-welcome .yw-head{display:flex;align-items:center;gap:12px}
  #yarg-pwa-welcome .yw-logo{width:64px;height:64px;object-fit:contain;flex:none}
  #yarg-pwa-welcome h2{font-size:1.35rem;line-height:1.18;margin:0;color:#fff}
  #yarg-pwa-welcome p{font-size:.95rem;line-height:1.5;color:#bfd2da;margin:14px 0}
  #yarg-pwa-welcome .yw-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:19px}
  #yarg-pwa-welcome button{flex:1 1 125px;border-radius:10px;padding:12px 13px;min-height:46px;font-size:.92rem;font-weight:850;border:1px solid #66808b;cursor:pointer}
  #yarg-pwa-welcome .yw-yes{background:#49d7bf;color:#08191c;border-color:#49d7bf}
  #yarg-pwa-welcome .yw-later{background:#26383f;color:#eff5f6}
  #yarg-pwa-welcome .yw-status{font-size:.83rem;margin:10px 0 0;color:#f2d39f}
  #yarg-pwa-welcome button:disabled{opacity:.6;cursor:wait}
  </style>
  <section class="yw-card" role="dialog" aria-modal="true" aria-labelledby="yarg-pwa-welcome-title" aria-describedby="yarg-pwa-welcome-desc">
   <div class="yw-head"><img class="yw-logo" src="assets/favicon.png?v=3" alt="">
    <h2 id="yarg-pwa-welcome-title">🔔 Ne manque pas ton tour !</h2></div>
   <p id="yarg-pwa-welcome-desc">Active les notifications pour recevoir tes invitations de groupe et savoir quand ton tour approche, même si l’application est fermée.</p>
   <p class="yw-extra"></p>
   <div class="yw-actions"><button type="button" class="yw-yes">Activer les notifications</button><button type="button" class="yw-later">Plus tard</button></div>
   <p class="yw-status" role="status" aria-live="polite"></p>
  </section>`;
  document.body.append(overlay);
  const yes=overlay.querySelector('.yw-yes'),later=overlay.querySelector('.yw-later'),status=overlay.querySelector('.yw-status');
  const extra=overlay.querySelector('.yw-extra');
  extra.textContent=kind==='first'&&!currentUid
   ?'Tu peux autoriser les notifications sans compte. Elles seront liées à ton profil lorsque tu te connecteras comme Rockstar.'
   :kind==='login'
     ?'Ton compte Rockstar peut maintenant recevoir ses propres notifications sur cet appareil.'
     :'Les notifications seront liées à ton compte Rockstar.';
  openDialog={overlay,kind,status};
  // Save the first decision immediately so a reload does not show this dialog forever.
  later.addEventListener('click',()=>{
   if(kind==='first')setStored(KEY,'declined');
   if(kind==='login'&&currentUid)setStored(SECOND,currentUid);
   closeOffer();
  });
  yes.addEventListener('click',async()=>{
   yes.disabled=true;later.disabled=true;
   try{
    if(Notification.permission==='denied'){
     status.textContent='Les notifications sont bloquées dans ce navigateur. Autorise-les dans les paramètres du site ou de l’application, puis reviens ici.';
     yes.disabled=false;later.disabled=false;
     if(kind==='first')setStored(KEY,'declined');
     if(kind==='login'&&currentUid)setStored(SECOND,currentUid);
     return;
    }
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permission!=='granted'){
     status.textContent='Notifications refusées. Tu pourras les activer plus tard dans les réglages du navigateur.';
     if(kind==='first')setStored(KEY,'declined');
     if(kind==='login'&&currentUid)setStored(SECOND,currentUid);
     yes.disabled=false;later.disabled=false;
     return;
    }
    setStored(KEY,'granted');
    if(kind==='login'&&currentUid)setStored(SECOND,currentUid);
    status.textContent=currentUid?'Connexion des notifications à ton compte…':'Permission accordée ! Les alertes personnalisées seront activées après connexion à ton compte Rockstar.';
    if(currentUid)await connectRockstar();
    if(!openDialog||openDialog.overlay!==overlay)return;
    if(!currentUid)closeOffer();
    else if(openDialog)later.disabled=false;
   }catch(error){
    console.warn('Autorisation des notifications YARG :',error);
    status.textContent='Impossible d’activer les notifications : '+(error?.message||'réessaie dans Profil → Notifications.');
    yes.disabled=false;later.disabled=false;
   }
  });
  yes.focus();
 }
 function considerLogin(user){
  const valid=profileUser(user);
  const uid=valid?.id||null;
  const changed=uid!==currentUid;
  currentUid=uid;
  if(uid&&Notification.permission==='granted'){
   setStored(KEY,'granted');
   void connectRockstar();
   return;
  }
  if(!uid||!changed||firstOfferShown||getStored(KEY)!=='declined'||getStored(SECOND)===uid)return;
  if(openDialog)return;
  setStored(SECOND,uid);
  showOffer('login');
 }
 function start(){
  if(!installed())return;
  if(window.supabase){
   authClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
   // Profile authorization can be completed later in this same app session.
   authClient.auth.onAuthStateChange((_event,session)=>{
    Promise.resolve().then(()=>considerLogin(session?.user));
   });
   void authClient.auth.getUser().then(({data})=>{
    const valid=profileUser(data?.user);
    initialUid=valid?.id||null;
    currentUid=initialUid;
    if(Notification.permission==='granted'){
     setStored(KEY,'granted');
     void connectRockstar();
    }
   }).catch(error=>console.warn('Vérification Rockstar :',error));
  }
  if(!getStored(KEY)&&Notification.permission!=='granted'){
   // Ask on the very first installed-app launch, regardless of login state.
   showOffer('first');
  }else if(Notification.permission==='granted'){
   setStored(KEY,'granted');
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
