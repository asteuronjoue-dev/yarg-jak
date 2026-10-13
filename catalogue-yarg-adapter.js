/* Adapter sans installation: songs.json = export direct de YARG.
   catalogue-reference.json est l'archive des IDs stables et des préférences
   d'affichage historiques. Ne pas le remplacer lors de l'ajout de chansons. */
(function(){
 const textJSON=async url=>{
  const response=await fetch(url,{cache:'no-cache'});
  if(!response.ok)throw new Error(url+' HTTP '+response.status);
  let body=await response.text();
  // YARG may export chart masks > Number.MAX_SAFE_INTEGER. Preserve each one
  // as a decimal STRING before JSON.parse, so the BigInt chart parser is exact.
  if(url==='songs.json')body=body.replace(/("chartsAvailable"\s*:\s*)(\d+)/g,'$1"$2"');
  return JSON.parse(body);
 };
 const slug = v => String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,150)||'song';
 const bits=(mask,i)=>(BigInt(mask||0)>>BigInt(i*6))&63n;
 const validYear=year=>/^\s*\d+\s*$/.test(String(year||''))?Number(year):0;
 const fnvHash=s=>{let hash=2166136261;for(let i=0;i<s.length;i++){hash=Math.imul(hash^s.charCodeAt(i),16777619)}return (hash>>>0).toString(36)};
 const normalizeRaw=(r,lookup,genres,used,gameApps)=>{
  const a=String(r.Artist||'').trim(),t=String(r.Name||'').trim();
  const al=String(r.Album||'').trim(),pl=String(r.Playlist||'').trim(),ch=String(r.Charter||'').trim();
  const y=validYear(r.Year),l=Math.floor(Number(r.songlength||0)/1000);
  const chartMask=String(r.chartsAvailable||'0');
  const key=JSON.stringify([a,t,al,y,l,pl,ch,chartMask]);
  const previous=lookup[key];let id=previous?.id;
  if(!id){const basis=slug([a,t,al,y,l].join('|'));id='yarg-'+basis;
   if(used.has(id)) id='yarg-'+basis.slice(0,135)+'-'+fnvHash(key);
  }
  if(used.has(id)){id=id.slice(0,245)+'-'+fnvHash(key);}
  used.add(id);
  let g=genres.indexOf(String(r.Genre||''));if(g<0){genres.push(String(r.Genre||'Autre'));g=genres.length-1;}
  const flags={V:bits(chartMask,8)!==0n,G:bits(chartMask,0)!==0n,B:bits(chartMask,1)!==0n,
   D:[3,4,5].some(i=>bits(chartMask,i)!==0n),K:[6,7].some(i=>bits(chartMask,i)!==0n)};
  const p=previous?.p||Object.keys(flags).filter(k=>flags[k]).join('');
  const vp=previous?.vp??(bits(chartMask,9)!==0n?3:flags.V?1:0);
  const d=previous?.d||'.....';
  const record={id,a,t,al,y,l,vp,p,d,g,pl,ch,chartMask};
  record.games=gameApps[id]||(pl?[pl]:[]);
  return record;
 };
 window.YARG_loadCatalogue=async function(){
  const [raw,ref]=await Promise.all([textJSON('songs.json'),textJSON('catalogue-reference.json')]);
  if(!Array.isArray(raw)||!ref?.legacy||!Array.isArray(ref.genres))
   throw new Error('songs.json ne correspond pas au format exporté par YARG (liste de chansons).');
  const genres=[...ref.genres],used=new Set(),apps=ref.games||{};
  const songs=raw.filter(r=>r&&typeof r==='object'&&r.Artist&&r.Name).map(r=>normalizeRaw(r,ref.legacy,genres,used,apps));
  if(!songs.length)throw new Error('Aucune chanson valide trouvée dans songs.json.');
  songs.sort((a,b)=>a.a.localeCompare(b.a,'fr')||a.t.localeCompare(b.t,'fr')||a.al.localeCompare(b.al,'fr')||a.l-b.l);
  return {songs,genres,meta:{source:'YARG',generated:new Date().toISOString().slice(0,10),count:songs.length},game_appearances:apps};
 };
})();
