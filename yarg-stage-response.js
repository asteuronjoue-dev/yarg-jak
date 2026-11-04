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
 const status=document.createElement('div');status.className='yarg-stage-message';status.setAttribute('role','status');
 const labels=[['ready','🤘HELL YEAH!🤘'],['later','Non! Remettre à plus tard!'],['decline','Non! Je ne veux plus participer à cette chanson!']];
 for(const [value,label] of labels){const b=document.createElement('button');b.type='button';b.dataset.stageAnswer=value;b.textContent=label;actions.append(b);}
 banner.append(heading,actions,status);document.body.prepend(banner);
 let lastRequestId='',lastAnswer='',working=false;
 let scheduled=null;
 const displayMode=new URLSearchParams(location.search).get('affichage')==='1';
 const esc=s=>String(s||'');
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
     const {data:reqs,error:re}=await client.from('performance_requests').select('id,status,requester_profile_id,guest_user_id,rockstar_name,song_title,song_artist,requester_withdrawn_at,created_at,yarg_not_ready').eq('party_session_id',settings.current_session_id).in('status',['waiting','full','playing']);
     if(re)throw re;
     const {data:fair,error:fe}=await client.rpc('yarg_get_fair_queue');if(fe)throw fe;
     const ordered=new Map((fair||[]).map(x=>[getUuid(x.request_id),Number(x.fair_position)]));
     const playing=(reqs||[]).filter(x=>x.status==='playing').sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
     const waiting=(reqs||[]).filter(x=>x.status!=='playing'&&!x.yarg_not_ready&&ordered.has(getUuid(x.id))).sort((a,b)=>ordered.get(getUuid(a.id))-ordered.get(getUuid(b.id)));
     const announced=[...playing.slice(0,1),...waiting.slice(0,1)];
     if(!announced.length){hide();return;}
     const requestIds=announced.map(x=>x.id);
     const {data:memberIds}=await client.rpc('yarg_my_band_member_ids');
     const owned=new Set((memberIds||[]).map(x=>getUuid(x.member_id)));
     const {data:members,error:me}=await client.from('performance_members').select('id,performance_request_id,rockstar_profile_id,withdrawn_at').in('performance_request_id',requestIds);
     if(me)throw me;
     const target=announced.find(r=>
       (!r.requester_withdrawn_at && (getUuid(r.requester_profile_id)===id||getUuid(r.guest_user_id)===id)) ||
       (members||[]).some(m=>getUuid(m.performance_request_id)===getUuid(r.id)&&!m.withdrawn_at&&(getUuid(m.rockstar_profile_id)===id||owned.has(getUuid(m.id)))));
     if(!target){hide();return;}
     const uuid=getUuid(target.id);
     if(uuid!==lastRequestId){lastAnswer='';status.textContent='';lastRequestId=uuid;}
     heading.replaceChildren();
     const call=document.createElement('div');call.textContent="C'EST TA TOUNE! READY TO ROCK?";
     const track=document.createElement('div');track.textContent=`🎶${esc(target.song_title)} • ${esc(target.song_artist)}🎶`;
     heading.append(call,track);
     banner.hidden=false;
     for(const b of actions.querySelectorAll('button'))b.disabled=working;
     syncHeight();
   }catch(e){console.warn('Bannière scène YARG :',e?.message||e);}
 }
 actions.addEventListener('click',async event=>{
   const button=event.target.closest('button[data-stage-answer]');if(!button||working||!lastRequestId)return;
   const reply=button.dataset.stageAnswer;
   if(reply==='decline'&&!confirm('Informer le MC que tu ne veux plus participer à cette chanson ? Il pourra libérer ton instrument.'))return;
   working=true;for(const b of actions.querySelectorAll('button'))b.disabled=true;
   status.textContent='Enregistrement de ta réponse…';
   try{
     const {error}=await client.rpc('yarg_respond_stage_call',{p_request_id:lastRequestId,p_reply:reply});
     if(error)throw error;
     lastAnswer=reply;
     status.textContent=reply==='ready'?'✅ Super! Le MC voit que tu es prêt.':reply==='later'?'⏸ Le MC est averti.':'❌ Le MC est averti et peut retirer ton instrument.';
     document.dispatchEvent(new CustomEvent('yarg-stage-replied',{detail:{requestId:lastRequestId,reply}}));
   }catch(e){status.textContent='Impossible d’enregistrer ta réponse : '+(e?.message||e);}
   finally{working=false;for(const b of actions.querySelectorAll('button'))b.disabled=false;}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 document.addEventListener('yarg-stage-replied',()=>setTimeout(refresh,700));
 window.addEventListener('pageshow',refresh);
 refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);
})();
