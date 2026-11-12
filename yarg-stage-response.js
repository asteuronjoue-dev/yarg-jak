/* YARG: unified "C'EST TA TOUNE" response banner. Loaded by index.html and file.html.
   Do not publish private auth data; all writes checked by Supabase RPC. */
(()=>{
 'use strict';
 if(!window.supabase)return;
 const base='https://xbhfjzurytdknbqvksjq.supabase.co';
 const key='sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
 const client=window.supabase.createClient(base,key);
 if(!document.getElementById('yarg-banner-font')){
   const font=document.createElement('link');
   font.id='yarg-banner-font';font.rel='stylesheet';
   font.href='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&display=swap';
   document.head.append(font);
 }
 const root=document.documentElement;
 const banner=document.createElement('aside');banner.id='yarg-stage-banner';banner.className='yarg-stage-banner';banner.hidden=true;
 banner.setAttribute('aria-label','Confirmation de la prestation');
 const heading=document.createElement('div');heading.className='yarg-stage-heading';
 const actions=document.createElement('div');actions.className='yarg-stage-actions';
 const details=document.createElement('div');details.className='yarg-stage-details';
 const pauseActions=document.createElement('div');pauseActions.className='yarg-stage-actions yarg-pause-actions';
 for(const [value,label] of [['ready','Okay! Je suis prêt à jouer!'],['leave','Je veux me retirer de toutes les chansons auxquelles je me suis inscrit.']]){
  const b=document.createElement('button');b.type='button';b.dataset.partyAction=value;b.textContent=label;pauseActions.append(b);
 }
 const status=document.createElement('div');status.className='yarg-stage-message';status.setAttribute('role','status');
 const labels=[['ready','🤘HELL YEAH!🤘'],['later','Non! Je prends une pause!'],['decline','Non! Je ne veux plus participer à cette chanson!']];
 for(const [value,label] of labels){const b=document.createElement('button');b.type='button';b.dataset.stageAnswer=value;b.textContent=label;actions.append(b);}
 banner.append(heading,details,actions,pauseActions,status);document.body.prepend(banner);
 // Stage calls take priority over secondary personal alerts.
 const priorityStyle=document.createElement('style');
 priorityStyle.textContent='body.yarg-stage-visible #yarg-my-next-banner,body.yarg-stage-visible #yarg-up-next-shared{display:none!important}';
 document.head.append(priorityStyle);
 const stageStyle=document.createElement('style');
 stageStyle.textContent=`
 @keyframes yargStageRainbow{to{background-position:300% center}}
 #yarg-stage-banner{position:fixed;top:0;left:0;right:0;z-index:15000;padding:12px clamp(10px,3vw,32px);text-align:center;box-shadow:0 6px 21px #0008;font:900 15px/1.4 system-ui,sans-serif}
 #yarg-stage-banner[hidden]{display:none!important}
 #yarg-stage-banner .yarg-stage-heading{font-family:'Barlow Condensed','Arial Narrow',system-ui,sans-serif;font-size:clamp(21px,3.3vw,34px);font-weight:800;letter-spacing:.025em;line-height:1.13}
 #yarg-stage-banner .yarg-stage-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
 #yarg-stage-banner .yarg-stage-actions button{font:900 15px system-ui,sans-serif;min-height:43px;border:2px solid #131a1c;border-radius:10px;padding:9px 14px;cursor:pointer;color:#101214}
 #yarg-stage-banner [data-stage-answer=ready]{background:#85eab2}
 #yarg-stage-banner [data-stage-answer=later]{background:#ffdb61}
 #yarg-stage-banner [data-stage-answer=decline]{background:#ff7883}
 #yarg-stage-banner button:disabled{opacity:.5}
 #yarg-stage-banner .yarg-stage-message{font-size:13px;font-weight:800;margin-top:4px}
 @media(max-width:650px){#yarg-stage-banner .yarg-stage-actions{display:grid;grid-template-columns:1fr}#yarg-stage-banner .yarg-stage-actions button{width:100%}}
 /* The whole fixed banner animates like the party title, not just the heading. */
 #yarg-stage-banner{
  background:linear-gradient(90deg,#ff355e,#ff9f1c,#ffe66d,#2ec4b6,#3a86ff,#8338ec,#ff355e);
  background-size:300% 100%;
  animation:yargStageRainbow 5s linear infinite;
  color:#fff;
  border-bottom:4px solid #171a22;
 }
 /* White lettering with a dark outline stays legible over every rainbow color. */
 #yarg-stage-banner .yarg-stage-heading .yarg-rainbow{
  background:none;animation:none;color:#fff;
  -webkit-text-stroke:0;
  text-shadow:0 2px 4px rgba(10,16,22,.78);
 }
 #yarg-stage-banner .yarg-stage-heading .yarg-track{
  color:#fff;font-family:system-ui,sans-serif;font-weight:750;font-size:.53em;letter-spacing:0;margin-top:5px;
  text-shadow:0 1px 2px rgba(10,16,22,.7);
 }
 #yarg-stage-banner .yarg-stage-details{
  color:#fff;font-family:system-ui,sans-serif;font-weight:750;margin-top:8px;font-size:clamp(14px,2vw,18px);
  text-shadow:0 1px 2px rgba(10,16,22,.65);
 }
 #yarg-stage-banner .yarg-stage-message{color:#fff;text-shadow:0 1px 3px #10141c}
 #yarg-stage-banner [data-party-action=ready]{background:#85eab2;color:#141a22}
 #yarg-stage-banner [data-party-action=leave]{background:#ff7883;color:#141a22}
 #yarg-stage-banner .yarg-stage-actions button{white-space:normal}
 #yarg-stage-banner.yarg-stage-is-ready{background:#193238;background-image:none;animation:none;border-bottom:2px solid #4fc9b9;padding:10px clamp(10px,3vw,32px)}
 #yarg-stage-banner.yarg-stage-is-ready .yarg-stage-heading{font-size:clamp(16px,2.5vw,22px)}
 #yarg-stage-banner.yarg-stage-is-ready .yarg-stage-heading .yarg-rainbow{color:#b2f8dd;-webkit-text-stroke:0;text-shadow:none}
 #yarg-stage-banner.yarg-stage-is-ready .yarg-stage-heading .yarg-track,#yarg-stage-banner.yarg-stage-is-ready .yarg-stage-details{font-size:13px;margin-top:3px;text-shadow:none;color:#e0f2ef}
 body.yarg-invite-active #yarg-stage-banner.yarg-stage-is-ready{display:none!important}
 `;
 document.head.append(stageStyle);
 let lastRequestId='',lastAnswer='',working=false,partyPaused=false,presenceSupported=false;
 // Keep a processed call dismissed while it is waiting. When it starts playing,
 // the banner returns in read-only LIVE mode.
 const acknowledgedWaiting=new Set();
 let scheduled=null;
 const esc=s=>String(s||'');
 const instInfo={flex:['🎲','Flex'],guitar:['🎸','Guitare'],rhythm_guitar:['🎸','Guitare rythmique'],bass:['🎸','Basse'],drums:['🥁','Batterie'],drums_4lane:['🥁','Batterie 4-Lane'],pro_drums:['🥁','Pro Drums'],keys:['🎹','Clavier 5-Lane'],pro_keys:['🎹','Pro Keys'],vocals:['🎤','Voix']};
 const difficultyName={beginner:'Débutant',easy:'Facile',medium:'Moyen',hard:'Difficile',expert:'Expert',any:'Peu importe'};
 const guitarName={'osp uze':'OSPUZE - Rockband',crkd:'Blue Guitar - CRKD',sunburst:'Sunburst - Guitar Hero'};
 function renderStageHeading(message,track){
  heading.replaceChildren();
  const a=document.createElement('div');a.className='yarg-rainbow';a.textContent=message;heading.append(a);
  if(track){const b=document.createElement('div');b.className='yarg-track';b.textContent=track;heading.append(b);}
 }
 function showStageMode(mode){banner.classList.toggle('yarg-stage-is-ready',mode==='ready');banner.classList.toggle('yarg-stage-is-pause',mode==='pause');actions.hidden=mode!=='next';actions.style.display=mode==='next'?'':'none';pauseActions.hidden=mode!=='pause';pauseActions.style.display=mode==='pause'?'':'none';banner.hidden=false;document.body.classList.add('yarg-stage-visible');syncHeight();}
 function instrumentForRequest(target,all,uid,owned){
  const active=all.filter(m=>String(m.performance_request_id)===String(target.id)&&!m.withdrawn_at);
  let mine=active.find(m=>String(m.rockstar_profile_id||'')===uid||owned.has(String(m.id)));
  if(!mine&&target.is_group_request&&(String(target.requester_profile_id||'')===uid||String(target.guest_user_id||'')===uid))mine=active.find(m=>String(m.rockstar_name||'').trim().toLowerCase()===String(target.rockstar_name||'').trim().toLowerCase());
  return mine||{instrument:target.requester_instrument,difficulty:target.requester_difficulty,preferred_guitar:null};
 }
 function stageInstrumentDetail(target,mine,all){
  const type=mine.instrument||'vocals',inst=instInfo[type]||['🎸',type];
  const difficulty=type==='vocals'?'Moyen':(difficultyName[mine.difficulty]||'Peu importe');
  let guitar='';
  if(['guitar','rhythm_guitar','bass'].includes(type)){
   if(mine.preferred_guitar&&guitarName[mine.preferred_guitar])guitar=guitarName[mine.preferred_guitar];
   else{
    const reserved=new Set(all.filter(m=>String(m.performance_request_id)===String(target.id)&&!m.withdrawn_at&&m.preferred_guitar).map(m=>m.preferred_guitar));
    const options=Object.entries(guitarName).filter(([id])=>!reserved.has(id)).map(([,name])=>name);
    guitar=options.length?options.join(' / '):'Peu importe';
   }
  }
  return {emoji:inst[0],label:`${inst[0]} ${inst[1]}${type==='vocals'?'':' • '+difficulty}${guitar?' • '+guitar:''} ${inst[0]}`};
 }
 async function setPartyPresence(action){
  if(!presenceSupported)throw Error('Migration Supabase des disponibilités non installée');
  const {error}=await client.rpc('yarg_set_my_party_presence',{p_action:action});if(error)throw error;
  document.dispatchEvent(new CustomEvent('yarg-party-presence-updated',{detail:{action}}));
 }
 function syncHeight(){
   const suppressed=document.body.classList.contains('yarg-invite-active')&&banner.classList.contains('yarg-stage-is-ready');
   const height=banner.hidden||suppressed?0:Math.ceil(banner.getBoundingClientRect().height);
   root.style.setProperty('--yarg-stage-height',height+'px');
   document.body.style.paddingTop=height?height+'px':'';
   // index.html already adds padding for the legacy fixed banner. Disable it.
   root.style.setProperty('--yarg-next-banner-height','0px');
 }
 const resize=window.ResizeObserver?new ResizeObserver(syncHeight):null;
 if(resize)resize.observe(banner);
 window.addEventListener('resize',syncHeight,{passive:true});
 function hide(){banner.hidden=true;document.body.classList.remove('yarg-stage-visible');lastRequestId='';lastAnswer='';syncHeight();}
 const getUuid=a=>String(a||'');
 async function refresh(){
     if(working)return;
   try{
     const {data:auth}=await client.auth.getUser();const id=auth?.user?.id;
     if(!id){hide();return;}
     const {data:settings,error:settingError}=await client.from('party_settings').select('current_session_id,performance_requests_enabled,party_mode_until').eq('id',1).maybeSingle();
     if(settingError||!settings?.current_session_id||!settings.performance_requests_enabled || (settings.party_mode_until && new Date(settings.party_mode_until)<new Date())){hide();return;}
     const presence=await client.rpc('yarg_my_party_presence');presenceSupported=!presence.error;partyPaused=presenceSupported&&presence.data===true;
     // Keep the pause warning visible on *every* page, even when none of
     // this account's requests is among the next two songs.
     if(partyPaused){
       renderStageHeading('Tu es en pause','Tes prestations à venir restent suspendues.');
       details.textContent='Appuie sur « Je suis prêt » pour reprendre ta place dans la file.';
       status.textContent='';
       lastRequestId='';
       showStageMode('pause');
       return;
     }
     const {data:reqs,error:re}=await client.from('performance_requests').select('id,status,requester_profile_id,guest_user_id,rockstar_name,is_group_request,requester_instrument,requester_difficulty,song_title,song_artist,requester_withdrawn_at,created_at,yarg_not_ready').eq('party_session_id',settings.current_session_id).in('status',['waiting','full','playing']);
     if(re)throw re;
     const {data:fair,error:fe}=await client.rpc('yarg_get_fair_queue');if(fe)throw fe;
     const ordered=new Map((fair||[]).map(x=>[getUuid(x.request_id),Number(x.fair_position)]));
     const playing=(reqs||[]).filter(x=>x.status==='playing').sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
     const waiting=(reqs||[]).filter(x=>x.status!=='playing'&&!x.yarg_not_ready&&ordered.has(getUuid(x.id))).sort((a,b)=>ordered.get(getUuid(a.id))-ordered.get(getUuid(b.id)));
     const announced=[...playing.slice(0,1),...waiting.slice(0,1)];
     for(const seen of acknowledgedWaiting){if(!announced.some(r=>getUuid(r.id)===seen))acknowledgedWaiting.delete(seen);}
     if(!announced.length&&!partyPaused){hide();return;}
     const requestIds=announced.map(x=>x.id);
     const {data:memberIds}=await client.rpc('yarg_my_band_member_ids');
     const owned=new Set((memberIds||[]).map(x=>getUuid(x.member_id)));
     const {data:members,error:me}=requestIds.length?await client.from('performance_members').select('id,performance_request_id,rockstar_profile_id,rockstar_name,instrument,difficulty,preferred_guitar,withdrawn_at').in('performance_request_id',requestIds):{data:[],error:null};
     if(me)throw me;
     const target=announced.find(r=>
       (!r.requester_withdrawn_at && (getUuid(r.requester_profile_id)===id||getUuid(r.guest_user_id)===id)) ||
       (members||[]).some(m=>getUuid(m.performance_request_id)===getUuid(r.id)&&!m.withdrawn_at&&(getUuid(m.rockstar_profile_id)===id||owned.has(getUuid(m.id)))));
     if(partyPaused&&target?.status!=='playing'){
      renderStageHeading('Tes performances sont en pause','');details.textContent='';status.textContent='';lastRequestId='';showStageMode('pause');return;
     }
     if(!target){hide();return;}
     const uuid=getUuid(target.id);
     if(uuid!==lastRequestId){lastAnswer='';status.textContent='';lastRequestId=uuid;}
     // The response is stored server-side. Reading it restores the correct banner on every page.
     let savedReply='';
     if(target.status!=='playing'){
       const {data:reply,error:replyError}=await client.rpc('yarg_my_stage_reply',{p_request_id:uuid});
       if(replyError)throw replyError;
       savedReply=String(reply||'');
     }
     if(target.status!=='playing' && (savedReply==='decline'||savedReply==='later'||(acknowledgedWaiting.has(uuid)&&savedReply!=='ready'))){hide();return;}
     const mine=instrumentForRequest(target,members||[],id,owned);
     const info=stageInstrumentDetail(target,mine,members||[]);
     if(target.status==='playing'){
       renderStageHeading("C'EST TA TOUNE EN CE MOMENT!",`${esc(target.song_title)} • ${esc(target.song_artist)}`);
       details.textContent='🤘 ROCK ON! 🤘';
       status.textContent='';showStageMode('live');
     }else if(savedReply==='ready'){
       renderStageHeading('Tu es prêt! Le MC prépare ta chanson.',esc(target.song_title)+' • '+esc(target.song_artist));
       details.textContent='Reste dans le coin, ça s’en vient!';
       status.textContent='';showStageMode('ready');
     }else{
       renderStageHeading("C'EST TA TOUNE! READY TO ROCK?",`${esc(target.song_title)} • ${esc(target.song_artist)}`);
       details.textContent=info.label;
       status.textContent='';showStageMode('next');
     }
     for(const b of actions.querySelectorAll('button'))b.disabled=working;
   }catch(e){console.warn('Bannière scène YARG :',e?.message||e);}
 }
 actions.addEventListener('click',async event=>{
   const button=event.target.closest('button[data-stage-answer]');if(!button||working||!lastRequestId)return;
   const reply=button.dataset.stageAnswer;
   if(reply==='decline'&&!confirm('Quitter immédiatement cette chanson et libérer ton instrument ? Le MC sera informé.'))return;
   working=true;for(const b of actions.querySelectorAll('button'))b.disabled=true;
   status.textContent='Enregistrement de ta réponse…';
   try{
     if(reply==='later'&&presenceSupported)await setPartyPresence('pause');
     else{const {error}=await client.rpc('yarg_respond_stage_call',{p_request_id:lastRequestId,p_reply:reply});if(error)throw error;}
     lastAnswer=reply;
     if(reply==='decline')acknowledgedWaiting.add(lastRequestId);
     if(reply==='ready')acknowledgedWaiting.delete(lastRequestId);
     status.textContent=reply==='ready'?'✅ Super! Le MC voit que tu es prêt.':reply==='later'?'⏸ Le MC est averti.':'❌ Participation retirée. Ton instrument est libre; le MC est informé.';
     document.dispatchEvent(new CustomEvent('yarg-stage-replied',{detail:{requestId:lastRequestId,reply}}));
     // An acknowledged ready call now changes into the preparation message.
     if(reply!=='ready')hide();
   }catch(e){console.error('Réponse à l’appel impossible :',e);status.textContent=window.yargErrorMessage?.(e,'Ta réponse n’a pas été enregistrée. Réessaie ou préviens le MC.')||'Ta réponse n’a pas été enregistrée. Réessaie ou préviens le MC.';}
   finally{working=false;for(const b of actions.querySelectorAll('button'))b.disabled=false;refresh();}
 });
 pauseActions.addEventListener('click',async event=>{
  const b=event.target.closest('button[data-party-action]');if(!b||working)return;
  const action=b.dataset.partyAction;
  if(action==='leave'&&!confirm('Te retirer de toutes tes prestations à venir? Tes instruments seront libérés.'))return;
  working=true;for(const btn of pauseActions.querySelectorAll('button'))btn.disabled=true;
  try{await setPartyPresence(action);partyPaused=false;hide();}
  catch(e){console.error('Disponibilité impossible :',e);status.textContent=window.yargErrorMessage?.(e,'Ta disponibilité n’a pas été modifiée. Réessaie ou préviens le MC.')||'Ta disponibilité n’a pas été modifiée. Réessaie ou préviens le MC.';}
  finally{working=false;for(const btn of pauseActions.querySelectorAll('button'))btn.disabled=false;refresh();}
 });
 document.addEventListener('yarg-invitation-visibility-changed',syncHeight);
 document.addEventListener('yarg-party-presence-updated',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 document.addEventListener('yarg-stage-replied',()=>setTimeout(refresh,700));
 window.addEventListener('pageshow',refresh);
 // React immediately when the MC changes a performance, even if this tab stays open.
 // Periodic polling is a fallback when the realtime transport is unavailable.
 client.channel('yarg-stage-transitions')
  .on('postgres_changes',{event:'*',schema:'public',table:'performance_requests'},()=>{refresh();})
  .on('postgres_changes',{event:'*',schema:'public',table:'performance_members'},()=>{refresh();})
  .subscribe();
 refresh();setInterval(()=>{if(!document.hidden)refresh()},5000);

})();
