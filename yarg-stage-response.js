/* YARG: unified "C'EST TA TOUNE" response banner. Loaded by index.html and file.html.
   Do not publish private auth data; all writes checked by Supabase RPC. */
(()=>{
 'use strict';
 if(!window.supabase)return;
 const base='https://xbhfjzurytdknbqvksjq.supabase.co';
 const key='sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
 const client=window.supabase.createClient(base,key);
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
 const stageStyle=document.createElement('style');
 stageStyle.textContent=`
 @keyframes yargStageRainbow{to{background-position:300% center}}
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
  -webkit-text-stroke:.55px #10141c;
  text-shadow:0 2px 3px #10141c,0 0 8px #10141c,0 0 2px #10141c;
 }
 #yarg-stage-banner .yarg-stage-heading .yarg-track{
  color:#fff;font-size:.8em;margin-top:4px;
  text-shadow:0 2px 3px #10141c,0 0 7px #10141c;
 }
 #yarg-stage-banner .yarg-stage-details{
  color:#fff;font-weight:850;margin-top:8px;font-size:clamp(14px,2vw,18px);
  text-shadow:0 2px 3px #10141c,0 0 7px #10141c;
 }
 #yarg-stage-banner .yarg-stage-message{color:#fff;text-shadow:0 1px 3px #10141c}
 #yarg-stage-banner [data-party-action=ready]{background:#85eab2;color:#141a22}
 #yarg-stage-banner [data-party-action=leave]{background:#ff7883;color:#141a22}
 #yarg-stage-banner .yarg-stage-actions button{white-space:normal}
 `;
 document.head.append(stageStyle);
 let lastRequestId='',lastAnswer='',working=false,partyPaused=false,presenceSupported=false;
 // Keep a processed call dismissed while it is waiting. When it starts playing,
 // the banner returns in read-only LIVE mode.
 const acknowledgedWaiting=new Set();
 let scheduled=null;
 const displayMode=new URLSearchParams(location.search).get('affichage')==='1';
 const esc=s=>String(s||'');
 const instInfo={guitar:['🎸','Guitare'],rhythm_guitar:['🎸','Guitare rythmique'],bass:['🎸','Basse'],drums:['🥁','Batterie'],drums_4lane:['🥁','Batterie 4-Lane'],pro_drums:['🥁','Pro Drums'],keys:['🎹','Clavier 5-Lane'],pro_keys:['🎹','Pro Keys'],vocals:['🎤','Voix']};
 const difficultyName={beginner:'Débutant',easy:'Facile',medium:'Moyen',hard:'Difficile',expert:'Expert',any:'Peu importe'};
 const guitarName={'osp uze':'OSPUZE - Rockband',crkd:'Blue Guitar - CRKD',sunburst:'Sunburst - Guitar Hero'};
 function renderStageHeading(message,track){
  heading.replaceChildren();
  const a=document.createElement('div');a.className='yarg-rainbow';a.textContent=message;heading.append(a);
  if(track){const b=document.createElement('div');b.className='yarg-track';b.textContent=track;heading.append(b);}
 }
 function showStageMode(mode){actions.hidden=mode!=='next';actions.style.display=mode==='next'?'':'none';pauseActions.hidden=mode!=='pause';pauseActions.style.display=mode==='pause'?'':'none';banner.hidden=false;syncHeight();}
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
   const height=banner.hidden?0:Math.ceil(banner.getBoundingClientRect().height);
   root.style.setProperty('--yarg-stage-height',height+'px');
   document.body.style.paddingTop=height?height+'px':'';
   // index.html already adds padding for the legacy fixed banner. Disable it.
   root.style.setProperty('--yarg-next-banner-height','0px');
 }
 const resize=window.ResizeObserver?new ResizeObserver(syncHeight):null;
 if(resize)resize.observe(banner);
 window.addEventListener('resize',syncHeight,{passive:true});
 function hide(){banner.hidden=true;lastRequestId='';lastAnswer='';syncHeight();}
 const getUuid=a=>String(a||'');
 async function refresh(){
   if(displayMode){hide();return;}
   if(working)return;
   try{
     const {data:auth}=await client.auth.getUser();const id=auth?.user?.id;
     if(!id){hide();return;}
     const {data:settings,error:settingError}=await client.from('party_settings').select('current_session_id,performance_requests_enabled,party_mode_until').eq('id',1).maybeSingle();
     if(settingError||!settings?.current_session_id||!settings.performance_requests_enabled || (settings.party_mode_until && new Date(settings.party_mode_until)<new Date())){hide();return;}
     const presence=await client.rpc('yarg_my_party_presence');presenceSupported=!presence.error;partyPaused=presenceSupported&&presence.data===true;
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
      renderStageHeading('⏸️Toutes tes performances à venir sont en pause.⏸️','');details.textContent='';status.textContent='';lastRequestId='';showStageMode('pause');return;
     }
     if(!target){hide();return;}
     const uuid=getUuid(target.id);
     if(target.status!=='playing' && acknowledgedWaiting.has(uuid)){hide();return;}
     if(uuid!==lastRequestId){lastAnswer='';status.textContent='';lastRequestId=uuid;}
     const mine=instrumentForRequest(target,members||[],id,owned);
     const info=stageInstrumentDetail(target,mine,members||[]);
     if(target.status==='playing'){
       renderStageHeading("🔥C'est ta toune en ce moment!🔥",`🎶${esc(target.song_title)} • ${esc(target.song_artist)}🎶`);
       details.textContent=`🤘${info.emoji} ROCK ON! ${info.emoji}🤘`;
       status.textContent='';showStageMode('live');
     }else{
       renderStageHeading("C'EST TA TOUNE! READY TO ROCK?",`🎶${esc(target.song_title)} • ${esc(target.song_artist)}🎶`);
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
     if(reply!=='later')acknowledgedWaiting.add(lastRequestId);
     status.textContent=reply==='ready'?'✅ Super! Le MC voit que tu es prêt.':reply==='later'?'⏸ Le MC est averti.':'❌ Participation retirée. Ton instrument est libre; le MC est informé.';
     document.dispatchEvent(new CustomEvent('yarg-stage-replied',{detail:{requestId:lastRequestId,reply}}));
     // No instant reappearance for a postponed bandmate's song.
     hide();
   }catch(e){status.textContent='Impossible d’enregistrer ta réponse : '+(e?.message||e);}
   finally{working=false;for(const b of actions.querySelectorAll('button'))b.disabled=false;}
 });
 pauseActions.addEventListener('click',async event=>{
  const b=event.target.closest('button[data-party-action]');if(!b||working)return;
  const action=b.dataset.partyAction;
  if(action==='leave'&&!confirm('Te retirer de toutes tes prestations à venir? Tes instruments seront libérés.'))return;
  working=true;for(const btn of pauseActions.querySelectorAll('button'))btn.disabled=true;
  try{await setPartyPresence(action);partyPaused=false;hide();}
  catch(e){status.textContent='Impossible de modifier ta disponibilité : '+(e?.message||e);}
  finally{working=false;for(const btn of pauseActions.querySelectorAll('button'))btn.disabled=false;refresh();}
 });
 document.addEventListener('yarg-party-presence-updated',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 document.addEventListener('yarg-stage-replied',()=>setTimeout(refresh,700));
 window.addEventListener('pageshow',refresh);
 refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);
})();
