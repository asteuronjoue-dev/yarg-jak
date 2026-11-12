/* Shared Rockstar band invitation banner. Only signed-in users see their own pending invitations.
   All invitation decisions are checked by the existing Supabase RPCs. */
(() => {
  'use strict';
  if (!window.supabase || !document.body || document.getElementById('yarg-invite-banner') || new URLSearchParams(location.search).get('affichage') === '1') return;
  const URL = 'https://xbhfjzurytdknbqvksjq.supabase.co';
  const KEY = 'sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
  const client = window.supabase.createClient(URL, KEY);
  const banner = document.createElement('aside');
  banner.id = 'yarg-invite-banner';
  banner.hidden = true;
  banner.setAttribute('aria-label', 'Invitations de groupe en attente');
  const header = document.createElement('div');
  header.className = 'yarg-invite-header';
  const title = document.createElement('strong');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'yarg-invite-close';
  close.textContent = 'Masquer';
  close.title = 'Masquer temporairement les invitations sur cette page';
  const expand = document.createElement('button');
  expand.type='button';expand.className='yarg-invite-expand';expand.textContent='Voir les invitations';expand.hidden=true;
  const list = document.createElement('div');
  list.className = 'yarg-invite-list';
  const status = document.createElement('div');
  status.className = 'yarg-invite-status';
  status.setAttribute('role', 'status');
  header.append(title, expand, close);
  banner.append(header, list, status);
  document.body.prepend(banner);
  const style = document.createElement('style');
  style.textContent = `
    #yarg-invite-banner{position:sticky;top:var(--yarg-invite-offset,0px);z-index:14900;margin:0;padding:12px clamp(12px,3vw,30px);background:#192c31;border-bottom:3px solid #1fc8bd;color:#f5f7f8;font:500 14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 5px 22px #0007;box-sizing:border-box}
    #yarg-invite-banner[hidden]{display:none!important}
    #yarg-invite-banner.is-compact{padding:7px 14px;background:#192c31;border-bottom-width:2px}
    #yarg-invite-banner.is-compact .yarg-invite-header{margin:0}
    #yarg-invite-banner.is-compact:not(.is-expanded) .yarg-invite-list,#yarg-invite-banner.is-compact:not(.is-expanded) .yarg-invite-status{display:none!important}
    #yarg-invite-banner.is-compact.is-expanded .yarg-invite-list{max-height:45vh;overflow:auto;margin-top:9px}
    #yarg-invite-banner .yarg-invite-expand{background:#284b4a;border-color:#6fd2c5;color:#fff}
    #yarg-invite-banner.is-compact .yarg-invite-close{margin-left:auto}
    body.yarg-stage-visible #yarg-invite-banner{box-shadow:0 3px 10px #0004}
    
    #yarg-invite-banner *{box-sizing:border-box}
    #yarg-invite-banner .yarg-invite-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}
    #yarg-invite-banner .yarg-invite-header strong{font-size:16px}
    #yarg-invite-banner .yarg-invite-list{display:flex;flex-wrap:wrap;gap:9px}
    #yarg-invite-banner .yarg-invite-item{display:flex;flex:1 1 300px;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid #45616a;background:#23383e}
    #yarg-invite-banner .yarg-invite-song{min-width:0;flex:1 1 190px;overflow-wrap:anywhere}
    #yarg-invite-banner .yarg-invite-song strong{display:block;font-size:14px;color:#fff}
    #yarg-invite-banner .yarg-invite-song small{color:#c5d6dc;display:block;font-size:12px;margin-top:3px}
    #yarg-invite-banner .yarg-invite-buttons{display:flex;gap:8px;flex-wrap:wrap}
    #yarg-invite-banner button{cursor:pointer;min-height:38px;border:1px solid #54707b;border-radius:8px;padding:8px 12px;font:800 13px system-ui,sans-serif}
    #yarg-invite-banner button:disabled{opacity:.5;cursor:wait}
    #yarg-invite-banner .yarg-invite-accept{background:#0b8b43;color:white;border-color:#13a957}
    #yarg-invite-banner .yarg-invite-decline{background:#ae233b;color:white;border-color:#d53a54}
    #yarg-invite-banner .yarg-invite-close{background:transparent;color:#d6e2e5}
    #yarg-invite-banner .yarg-invite-status{font-size:12px;margin-top:5px;color:#ffd2ad}
    #yarg-invite-banner .yarg-invite-status:empty{display:none}
    @media(max-width:600px){#yarg-invite-banner .yarg-invite-item{flex-basis:100%}#yarg-invite-banner .yarg-invite-buttons{width:100%}#yarg-invite-banner .yarg-invite-buttons button{flex:1}}
  `;
  document.head.append(style);

  let currentUser = null;
  let pending = [];
  let busy = false;
  let muted = false; // Only hides the banner until navigation or a new invitation arrives.
  let lastSignature = '';
  let lastStageHeight = -1;
  let manuallyExpanded = false;
  function stageOffset(){
    const stage = document.getElementById('yarg-stage-banner');
    const active = !!(stage && !stage.hidden && getComputedStyle(stage).display!=='none');
    const height = active ? Math.ceil(stage.getBoundingClientRect().height) : 0;
    if(height !== lastStageHeight){
      lastStageHeight = height;
      banner.style.setProperty('--yarg-invite-offset', height + 'px');
    }
    banner.classList.toggle('is-compact',active);
    banner.classList.toggle('is-expanded',active && manuallyExpanded);
    expand.hidden=!active;
    expand.textContent=manuallyExpanded?'Réduire':'Voir les invitations';
  }
  function render(){
    banner.hidden = !currentUser || !pending.length || muted;
    const hasInvitation=!banner.hidden;
    const wasActive=document.body.classList.contains('yarg-invite-active');
    document.body.classList.toggle('yarg-invite-active',hasInvitation);
    stageOffset();
    if(wasActive!==hasInvitation)document.dispatchEvent(new Event('yarg-invitation-visibility-changed'));
    if(banner.hidden) return;
    const compact=banner.classList.contains('is-compact');
    title.textContent = compact ? (pending.length===1?'1 invitation en attente':pending.length+' invitations en attente') : (pending.length===1?'Invitation à rejoindre un groupe':pending.length+' invitations à rejoindre un groupe');
    list.replaceChildren();
    for(const invitation of pending){
      const item = document.createElement('div');item.className='yarg-invite-item';
      const info = document.createElement('div');info.className='yarg-invite-song';
      const song = document.createElement('strong');
      song.textContent = (invitation.song_title || 'Chanson') + ' — ' + (invitation.song_artist || 'Artiste inconnu');
      const detail = document.createElement('small');
      detail.textContent = 'Rockstar : ' + (invitation.rockstar_name || '—') + ' · Instrument : ' + (invitation.instrument_mode || 'Au choix');
      info.append(song,detail);
      const actions = document.createElement('div');actions.className='yarg-invite-buttons';
      for(const [decision,label,cls] of [[true,'Accepter','yarg-invite-accept'],[false,'Refuser','yarg-invite-decline']]){
        const btn=document.createElement('button');btn.type='button';btn.className=cls;btn.textContent=label;
        btn.addEventListener('click',async()=>{
          if(busy)return;
          busy=true;status.textContent='Enregistrement de la réponse…';
          item.querySelectorAll('button').forEach(b=>b.disabled=true);
          try{
            const {error}=await client.rpc('yarg_respond_band_invitation',{p_invitation_id:invitation.id,p_accept:decision});
            if(error)throw error;
            pending=pending.filter(x=>String(x.id)!==String(invitation.id));
            status.textContent=decision?'Invitation acceptée.':'Invitation refusée.';
            render();
            document.dispatchEvent(new CustomEvent('yarg-band-invitation-responded',{detail:{accepted:decision,invitationId:invitation.id}}));
            await refresh(true);
          }catch(error){
            console.error('Réponse à une invitation impossible :',error);
            status.textContent=window.yargErrorMessage?.(error,'Ta réponse n’a pas été enregistrée. Réessaie dans un instant.')||'Ta réponse n’a pas été enregistrée. Réessaie dans un instant.';
            item.querySelectorAll('button').forEach(b=>b.disabled=false);
          }finally{busy=false;}
        });
        actions.append(btn);
      }
      item.append(info,actions);list.append(item);
    }
  }
  close.addEventListener('click',()=>{muted=true;render();});
  expand.addEventListener('click',()=>{manuallyExpanded=!manuallyExpanded;render();});
  async function refresh(force=false){
    if(busy || (document.hidden && !force))return;
    try{
      const {data:{user},error:authError}=await client.auth.getUser();
      if(authError || !user || user.is_anonymous || user.app_metadata?.provider==='anonymous'){
        currentUser=null;pending=[];muted=false;lastSignature='';status.textContent='';render();return;
      }
      const switched = currentUser && user.id!==currentUser.id;
      currentUser=user;
      const {data,error}=await client.rpc('yarg_my_band_invitations');
      if(error)throw error;
      pending=Array.isArray(data)?data:[];
      const signature=pending.map(x=>String(x.id)).sort().join('|');
      if(switched || (signature!==lastSignature && signature)){muted=false;manuallyExpanded=false;}
      lastSignature=signature;
      status.textContent='';
      render();
    }catch(error){
      // Keep the last known invitations visible if a network refresh fails.
      console.warn('Invitations Rockstar :',error.message||error);
    }
  }
  void refresh(true);
  setInterval(()=>{stageOffset();void refresh();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh(true);});
  window.addEventListener('resize',()=>{stageOffset();if(!banner.hidden)title.textContent=banner.classList.contains('is-compact')?(pending.length===1?'1 invitation en attente':pending.length+' invitations en attente'):(pending.length===1?'Invitation à rejoindre un groupe':pending.length+' invitations à rejoindre un groupe');},{passive:true});
  const stageObserver=new MutationObserver(()=>{
    const wasCompact=banner.classList.contains('is-compact');
    stageOffset();
    if(wasCompact!==banner.classList.contains('is-compact')){manuallyExpanded=false;render();}
  });
  const stageElement=document.getElementById('yarg-stage-banner');
  if(stageElement)stageObserver.observe(stageElement,{attributes:true,attributeFilter:['hidden','class','style']});
  document.addEventListener('yarg-stage-replied',()=>{manuallyExpanded=false;render();});
  if(client.auth?.onAuthStateChange){
    client.auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(true),0);});
  }
})();
