/* Bannière partagée YARG : identité de performance enregistrée sur ce navigateur.
   Aucun secret d'administration côté navigateur. */
(()=>{
 const SB_URL='https://xbhfjzurytdknbqvksjq.supabase.co';
 const PUBLIC_KEY='sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
 const banner=document.getElementById('yarg-up-next-shared');
 if(!banner || !window.supabase)return;
 const client=window.supabase.createClient(SB_URL,PUBLIC_KEY);
 let busy=false;
 function storedIds(key){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return new Set(Array.isArray(a)?a.map(String):[])}catch{return new Set()}}
 const myOwn=()=>storedIds('yarg_owned_performance_requests');
 const myJoined=()=>storedIds('yarg_joined_performance_requests');
 async function refresh(){
  if(busy||document.hidden)return;busy=true;
  try{
   const {data:next,error}=await client.rpc('yarg_next_performance_notice');
   if(error)throw error;
   if(!next?.id){banner.hidden=true;return}
   const mine=!!next.is_member || myOwn().has(String(next.id)) || myJoined().has(String(next.id));
   banner.hidden=!mine;
   if(mine){banner.textContent=`🌈 À TOI BIENTÔT! ${next.song_title} — ${next.song_artist} · Prépare tes instruments!`}
  }catch(e){console.warn('Bannière YARG :',e);banner.hidden=true}
  finally{busy=false}
 }
 refresh();setInterval(refresh,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
