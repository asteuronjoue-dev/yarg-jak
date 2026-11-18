'use strict';
/* Détecteur de doublons YARG : analyse locale, aucune écriture dans le catalogue. */
const SUPABASE_URL='https://xbhfjzurytdknbqvksjq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_6Wb-cHEYLF1T8JMZYoAveQ_eDmCprlM';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const STORAGE_KEY='yarg_duplicate_review_v1';
const FIELD_NAMES={Name:'Titre',Artist:'Artiste',Album:'Album',Playlist:'Playlist / collection',Genre:'Genre',Charter:'Charter',Year:'Année',songlength:'Durée (ms)',chartsAvailable:'Masque des partitions'};
const CHARTS=[['Guitare',0],['Basse',1],['Guitare rythmique',2],['Batterie 4 voies',3],['Batterie 5 voies (source)',4],['Pro Drums',5],['Clavier 5 voies',6],['Pro Keys',7],['Chant',8]];
const DIFFICULTIES=[[1n,'Débutant'],[2n,'Facile'],[4n,'Moyen'],[8n,'Difficile'],[16n,'Expert'],[32n,'Expert+']];
let songs=[],groups=[],decisions={},notes={},ignored={},shown=15,renderTimer=0;
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fold(text){return String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function titleBase(text){
 return fold(String(text||'')
  .replace(/\s*[\[(][^\])]*\b(?:live|acoustic|remaster(?:ed)?|radio edit|remix|demo|instrumental|cover|unplugged|re[- ]recorded|ft\.?|feat\.?|featuring)\b[^\])]*[\])]/gi,'')
  .replace(/\s*[-–:]\s*(?:live|acoustic|remastered?|radio edit|remix|demo|instrumental|unplugged)(?:\s.*)?$/i,''));
}
function artistBase(text){return fold(String(text||'').replace(/\s*[\[(](?:feat\.?|ft\.?|featuring)\b[^\])]*[\])]/gi,'').replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i,''));}
function variant(s){
 const title=String(s.Name||''),album=String(s.Album||'');
 if(/\b(?:live|unplugged|concert)\b/i.test(title)||/\b(?:live|unplugged)\b/i.test(album))return 'En concert';
 if(/\b(?:acoustic|acoustique)\b/i.test(title))return 'Acoustique';
 if(/\b(?:instrumental|karaoke)\b/i.test(title))return 'Instrumentale';
 if(/\b(?:demo)\b/i.test(title))return 'Démo';
 if(/\b(?:remix|mix|radio edit|single edit)\b/i.test(title))return 'Mix / edit';
 if(/\b(?:re[- ]recorded|cover)\b/i.test(title))return 'Réenregistrement / reprise';
 if(/\b(?:remaster(?:ed)?)\b/i.test(title))return 'Remaster';
 return 'Version non précisée';
}
function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function duration(ms){const n=Number(ms);if(!Number.isFinite(n)||n<=0)return 'Inconnue';const total=Math.round(n/1000);return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');}
function trackBits(s,i){try{return (BigInt(String(s.chartsAvailable||'0'))>>BigInt(i*6))&63n;}catch{return 0n;}}
function vocalParts(s){if(trackBits(s,8)===0n)return 0;const b=trackBits(s,9);return b>=7n?3:b>=3n?2:1;}
function supportedTracks(s){return CHARTS.filter(([name,i])=>trackBits(s,i)!==0n);}
function chartScore(s){
 const tracks=supportedTracks(s);
 const usable=tracks.filter(([name,i])=>i!==4);
 let difficulties=0;
 for(const [,i] of usable){const b=trackBits(s,i);for(const [bit] of DIFFICULTIES)if((b&bit)!==0n)difficulties++;}
 return usable.length*100+difficulties*3+vocalParts(s)*10;
}
function trackDetails(s){
 const tracks=supportedTracks(s);
 if(!tracks.length)return '<p class="muted">Aucune partition identifiée dans le masque.</p>';
 return '<ul class="part-list">'+tracks.map(([name,i])=>{
   const bits=trackBits(s,i),ds=DIFFICULTIES.filter(([bit])=>(bits&bit)!==0n).map(([,label])=>label);
   const extra=i===8?' · '+vocalParts(s)+' voix possible(s)':'';
   return '<li><strong>'+esc(name)+'</strong>'+extra+' : '+esc(ds.join(', ')||'Difficulté non précisée')+'</li>';
 }).join('')+'</ul>';
}
function similarity(a,b){
 if(a===b)return 1;
 const n=a.length,m=b.length;if(!n||!m)return 0;
 if(Math.abs(n-m)/Math.max(n,m)>.2)return 0;
 let previous=Array.from({length:m+1},(_,i)=>i);
 for(let i=1;i<=n;i++){
  const current=[i];
  for(let j=1;j<=m;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
  previous=current;
 }
 return 1-previous[m]/Math.max(n,m);
}
function potentialMatch(a,b){
 if(a.artistKey===b.artistKey&&a.titleKey===b.titleKey)return 100;
 if(a.titleKey===b.titleKey&&a.artistKey.length>3&&b.artistKey.length>3&&similarity(a.artistKey,b.artistKey)>=.87)return 87;
 if(a.artistKey===b.artistKey&&Math.min(a.titleKey.length,b.titleKey.length)>=7){
  const overlap=a.titleKey.slice(0,4)===b.titleKey.slice(0,4)||a.titleKey.split(' ')[0]===b.titleKey.split(' ')[0];
  if(overlap&&similarity(a.titleKey,b.titleKey)>=.87)return 73;
 }
 return 0;
}
function analyse(){
 const n=songs.length,root=Array.from({length:n},(_,i)=>i),rank=new Uint8Array(n);
 function find(i){while(root[i]!==i){root[i]=root[root[i]];i=root[i];}return i;}
 function unite(i,j){let a=find(i),b=find(j);if(a===b)return;if(rank[a]<rank[b])[a,b]=[b,a];root[b]=a;if(rank[a]===rank[b])rank[a]++;}
 const byArtist=new Map(),byTitle=new Map();
 for(let i=0;i<n;i++){
  const s=songs[i];
  if(!byArtist.has(s.artistKey))byArtist.set(s.artistKey,[]);
  byArtist.get(s.artistKey).push(i);
  if(!byTitle.has(s.titleKey))byTitle.set(s.titleKey,[]);
  byTitle.get(s.titleKey).push(i);
 }
 // Comparer uniquement des chansons du même artiste (ou des titres identiques
 // avec artistes presque identiques) évite les faux doublons entre reprises.
 for(const list of byArtist.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  if(potentialMatch(songs[list[i]],songs[list[j]])>0)unite(list[i],list[j]);
 }
 for(const list of byTitle.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  if(potentialMatch(songs[list[i]],songs[list[j]])>0)unite(list[i],list[j]);
 }
 const clusters=new Map();
 for(let i=0;i<n;i++){const k=find(i);if(!clusters.has(k))clusters.set(k,[]);clusters.get(k).push(songs[i]);}
 groups=[...clusters.values()].filter(items=>items.length>1).map(items=>{
  const names=new Set(items.map(x=>fold(x.Name))),artists=new Set(items.map(x=>fold(x.Artist)));
  const versions=new Set(items.map(variant));
  const durations=items.map(x=>Number(x.songlength)||0).filter(x=>x>0);
  const spread=durations.length?Math.max(...durations)-Math.min(...durations):0;
  const durationVariant=spread>22000&&(spread/Math.max(...durations))>.07;
  const versionVariant=versions.size>1;
  const kind=versionVariant||durationVariant?'variant':names.size===1&&artists.size===1?'exact':'likely';
  const sorted=[...items].sort((a,b)=>chartScore(b)-chartScore(a)||a.index-b.index);
  const top=sorted[0],next=sorted[1];
  const suggested=top&&next&&chartScore(top)>chartScore(next)?top.id:null;
  const identity=hash(items.map(x=>x.id).sort().join('|'));
  return {id:identity,items:sorted,kind,title:items[0].Name,artist:items[0].Artist,suggested,
   warning:versionVariant?'Les libellés indiquent potentiellement des éditions/enregistrements différents.':durationVariant?'Durées sensiblement différentes : vérifie qu’il s’agit bien du même enregistrement.':kind==='exact'?'Même artiste et même titre, avec des durées proches.':'Titres ou crédits légèrement différents : écoute/compare avant de supprimer.'};
 }).sort((a,b)=>({exact:0,likely:1,variant:2}[a.kind]-{exact:0,likely:1,variant:2}[b.kind])||a.artist.localeCompare(b.artist,'fr'));
}
function loadSaved(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');decisions=x.decisions&&typeof x.decisions==='object'?x.decisions:{};notes=x.notes&&typeof x.notes==='object'?x.notes:{};ignored=x.ignored&&typeof x.ignored==='object'?x.ignored:{};}
 catch{decisions={};notes={};ignored={};}
}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({decisions,notes,ignored}));}
 catch(e){$('result-summary').textContent='Impossible d’enregistrer les décisions dans le navigateur : '+e.message;}
}
function groupedDeleteCount(g){return ignored[g.id]?0:g.items.filter(x=>decisions[x.id]==='delete').length;}
function visibleGroups(){
 const filter=$('filter').value,query=fold($('search').value),sort=$('sort').value;
 const result=groups.filter(g=>{
  if(query&&!g.items.some(s=>s.searchText.includes(query)))return false;
  if(filter==='unreviewed'&&(ignored[g.id]||g.items.some(s=>decisions[s.id])))return false;
  if(filter==='marked'&&!groupedDeleteCount(g))return false;
  if(filter==='ignored'&&!ignored[g.id])return false;
  if(['exact','variant','likely'].includes(filter)&&g.kind!==filter)return false;
  if(filter!=='ignored'&&ignored[g.id]&&filter!=='all')return false;
  return true;
 });
 if(sort==='artist')result.sort((a,b)=>a.artist.localeCompare(b.artist,'fr')||a.title.localeCompare(b.title,'fr'));
 if(sort==='size')result.sort((a,b)=>b.items.length-a.items.length);
 if(sort==='review')result.sort((a,b)=>Number(!!ignored[a.id]||a.items.some(s=>decisions[s.id]))-Number(!!ignored[b.id]||b.items.some(s=>decisions[s.id])));
 return result;
}
function metadata(s){
 return '<dl class="metadata">'+Object.entries(FIELD_NAMES).map(([key,label])=>{
  const value=key==='songlength'?duration(s.songlength)+' ('+s.songlength+' ms)':String(s[key]??'—');
  const wide=key==='Name'||key==='Artist'||key==='chartsAvailable'?' span2':'';
  return '<div class="'+wide+'"><dt>'+esc(label)+'</dt><dd>'+esc(value||'—')+'</dd></div>';
 }).join('')+'</dl>';
}
function songCard(g,s){
 const choice=decisions[s.id]||'',selectedKeep=choice==='keep',selectedDelete=choice==='delete';
 const score=chartScore(s),suggestion=g.suggested===s.id?'Suggestion : plus de partitions jouables':'';
 const tracks=supportedTracks(s);
 return '<section class="song-card'+(selectedKeep?' song-card--keep':'')+(selectedDelete?' song-card--delete':'')+'">'+
 '<div class="song-indicator'+(suggestion?' better':'')+'">Entrée n° '+(s.index+1)+(suggestion?' · '+esc(suggestion):'')+'</div>'+
 '<h3>'+esc(s.Name)+'</h3><div class="song-artist">'+esc(s.Artist)+'</div>'+
 '<div class="track-strip">'+tracks.map(([name])=>'<span class="track">'+esc(name)+'</span>').join('')+(tracks.length?'':'<span class="track">Aucune partition identifiée</span>')+'</div>'+
 metadata(s)+
 '<details><summary>Voir les difficultés et harmonies ('+tracks.length+' pistes)</summary>'+trackDetails(s)+'</details>'+
 '<label class="field song-note"><small>Note personnelle (ex. dossier où trouver ce fichier)</small><textarea data-note="'+esc(s.id)+'" rows="2" placeholder="Note facultative pour retrouver le bon fichier">'+esc(notes[s.id]||'')+'</textarea></label>'+
 '<div class="song-choices"><button type="button" class="'+(selectedKeep?'keep-selected':'')+'" data-action="keep" data-group="'+esc(g.id)+'" data-id="'+esc(s.id)+'" aria-pressed="'+selectedKeep+'">'+(selectedKeep?'✓ À garder':'Garder celle-ci')+'</button>'+
 '<label class="delete-toggle"><input type="checkbox" data-action="delete" data-id="'+esc(s.id)+'" data-group="'+esc(g.id)+'" '+(selectedDelete?'checked':'')+'> À supprimer</label></div></section>';
}
function groupCard(g){
 const title={exact:'Doublon très probable',variant:'Versions différentes · prudence',likely:'Correspondance à vérifier'}[g.kind];
 const actionKeep=g.items.find(x=>decisions[x.id]==='keep');
 return '<article class="match-group'+(ignored[g.id]?' match-group--ignored':'')+'" id="group-'+esc(g.id)+'">'+
 '<div class="match-header"><div class="match-heading"><h2>'+esc(g.title)+'</h2><div class="artist">'+esc(g.artist)+'</div>'+
 '<div class="match-meta"><span class="match-flag '+(g.kind==='exact'?'strong':g.kind)+'">'+esc(title)+'</span><span class="match-flag">'+g.items.length+' versions</span></div>'+
 '<div class="match-tip">'+esc(g.warning)+'</div></div>'+
 '<div class="match-actions"><button type="button" class="quiet" data-action="ignore" data-group="'+esc(g.id)+'">'+(ignored[g.id]?'↩ Réexaminer':'Ignorer ce groupe')+'</button>'+
 '<button type="button" class="danger" data-action="batch" data-group="'+esc(g.id)+'" '+(!actionKeep||ignored[g.id]?'disabled':'')+'>Marquer les autres à supprimer</button></div></div>'+
 '<div class="song-grid">'+g.items.map(s=>songCard(g,s)).join('')+'</div></article>';
}
function render(){
 const all=visibleGroups(),current=all.slice(0,shown);
 const toDelete=groups.reduce((sum,g)=>sum+groupedDeleteCount(g),0);
 const reviewed=groups.filter(g=>ignored[g.id]||g.items.some(s=>decisions[s.id])).length;
 const exact=groups.filter(g=>g.kind==='exact').length;
 $('stats').innerHTML=[
  [songs.length.toLocaleString('fr-CA'),'chansons analysées'],
  [groups.length.toLocaleString('fr-CA'),'groupes suspects'],
  [exact.toLocaleString('fr-CA'),'groupes très probables'],
  [reviewed.toLocaleString('fr-CA'),'groupes examinés'],
  [toDelete.toLocaleString('fr-CA'),'chansons à supprimer']
 ].map(([n,label])=>'<div class="stat"><strong>'+n+'</strong><span>'+label+'</span></div>').join('');
 $('result-summary').textContent=all.length+' groupe(s) correspondant aux filtres · '+Math.min(shown,all.length)+' affiché(s)';
 $('group-list').innerHTML=current.length?current.map(groupCard).join(''):'<div class="empty">Aucun groupe ne correspond à cette recherche.</div>';
 $('more').hidden=shown>=all.length;
 $('export').disabled=toDelete===0;
}
function findGroup(id){return groups.find(g=>g.id===id);}
function chooseKeep(g,id){
 for(const s of g.items)if(decisions[s.id]==='keep')delete decisions[s.id];
 if(id)decisions[id]='keep';
 delete ignored[g.id];save();render();
}
function chooseDelete(g,id,checked){
 if(checked){
  if(decisions[id]==='keep')delete decisions[id];
  decisions[id]='delete';
 }else if(decisions[id]==='delete')delete decisions[id];
 delete ignored[g.id];save();render();
}
function exportReport(){
 const marked=groups.map(g=>({g,items:g.items.filter(s=>!ignored[g.id]&&decisions[s.id]==='delete')})).filter(x=>x.items.length);
 if(!marked.length)return;
 const lines=[
 'YARG — LISTE DES CHANSONS MARQUÉES À SUPPRIMER',
 'Généré le '+new Date().toLocaleString('fr-CA'),
 'Catalogue consulté : songs.json — '+songs.length+' entrées',
 'Chansons marquées à supprimer : '+marked.reduce((n,x)=>n+x.items.length,0),
 '',
 'ATTENTION : Cette liste est une aide pour supprimer MANUELLEMENT des fichiers.',
 'Le fichier songs.json ne contient pas les chemins de fichiers sur le disque.',
 'Vérifier les versions live, acoustiques, remix, reprises et la qualité des chartes avant de supprimer.',
 'Aucun fichier ni entrée de songs.json n’a été modifié par cet outil.',
 '',
 '============================================================'
 ];
 const dump=(s)=>{
  const out=['Entrée n° '+(s.index+1)+' dans le catalogue actuel'];
  for(const [key,label] of Object.entries(FIELD_NAMES))out.push(label+' : '+(key==='songlength'?duration(s.songlength)+' ('+s.songlength+' ms)':String(s[key]??'—')));
  out.push('Pistes disponibles : '+(supportedTracks(s).map(([name])=>name).join(', ')||'Aucune'));
  out.push('Harmonies possibles : '+vocalParts(s));
  for(const [name,i] of supportedTracks(s)){
   const bits=trackBits(s,i);
   out.push('  '+name+' : '+(DIFFICULTIES.filter(([bit])=>(bits&bit)!==0n).map(([,name])=>name).join(', ')||'Inconnue'));
  }
  if(notes[s.id])out.push('NOTE PERSONNELLE : '+notes[s.id]);
  return out;
 };
 for(let i=0;i<marked.length;i++){
  const {g,items}=marked[i];
  lines.push('',(i+1)+'. '+g.artist+' — '+g.title,'Type de correspondance : '+({exact:'Doublon très probable',variant:'Versions potentiellement différentes',likely:'Correspondance à vérifier'}[g.kind]));
  const keep=g.items.find(s=>decisions[s.id]==='keep');
  if(keep){lines.push('VERSION À GARDER :',...dump(keep));}else lines.push('VERSION À GARDER : Non choisie — vérifier avant toute suppression.');
  for(const s of items){lines.push('','*** À SUPPRIMER MANUELLEMENT ***',...dump(s));}
  lines.push('------------------------------------------------------------');
 }
 const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='YARG_doublons_a_supprimer_'+new Date().toISOString().slice(0,10)+'.txt';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function loadCatalogue(){
 $('loading').hidden=false;$('loading').textContent='Chargement de songs.json et comparaison des chansons…';
 $('workspace').hidden=true;
 try{
  const response=await fetch('songs.json?nettoyage='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('songs.json : HTTP '+response.status);
  const raw=await response.text();
  const safelyParsed=raw.replace(/("chartsAvailable"\s*:\s*)(-?\d+)(?=\s*[,}])/g,'$1"$2"');
  const parsed=JSON.parse(safelyParsed);
  if(!Array.isArray(parsed))throw new Error('Le catalogue n’est pas un tableau JSON.');
  const repeated=new Map();
  songs=parsed.map((rawSong,index)=>{
   const signature=JSON.stringify([rawSong.Name,rawSong.Artist,rawSong.Album,rawSong.Playlist,rawSong.Genre,rawSong.Charter,rawSong.Year,rawSong.songlength,rawSong.chartsAvailable]);
   const ordinal=(repeated.get(signature)||0)+1;repeated.set(signature,ordinal);
   const id=hash(signature)+'-'+ordinal;
   const song={...rawSong,index,id,titleKey:titleBase(rawSong.Name),artistKey:artistBase(rawSong.Artist)};
   song.searchText=fold([song.Name,song.Artist,song.Album,song.Playlist,song.Charter,song.Genre,song.Year].join(' '));
   return song;
  });
  analyse();shown=15;render();
  $('loading').textContent='Catalogue analysé. Les suggestions ne sont pas des décisions de suppression.';
  $('workspace').hidden=false;
 }catch(e){$('loading').textContent='Erreur de lecture du catalogue : '+e.message;}
}
function bindUI(){
 $('search').addEventListener('input',()=>{clearTimeout(renderTimer);renderTimer=setTimeout(()=>{shown=15;render();},120)});
 for(const id of ['filter','sort'])$(id).addEventListener('change',()=>{shown=15;render();});
 $('more').addEventListener('click',()=>{shown+=15;render();});
 $('rescan').addEventListener('click',loadCatalogue);
 $('export').addEventListener('click',exportReport);
 $('reset').addEventListener('click',()=>{
  if(!confirm('Effacer toutes les décisions, notes et groupes ignorés enregistrés sur cet appareil ?'))return;
  decisions={};notes={};ignored={};save();render();
 });
 $('group-list').addEventListener('input',e=>{
  const input=e.target.closest('[data-note]');if(!input)return;
  const value=input.value; if(value.trim())notes[input.dataset.note]=value;else delete notes[input.dataset.note];
  save();
 });
 $('group-list').addEventListener('change',e=>{
  const input=e.target.closest('input[data-action="delete"]');if(!input)return;
  const g=findGroup(input.dataset.group);if(g)chooseDelete(g,input.dataset.id,input.checked);
 });
 $('group-list').addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const action=button.dataset.action,g=findGroup(button.dataset.group);if(!g)return;
  if(action==='keep'){
   const next=decisions[button.dataset.id]==='keep'?null:button.dataset.id;
   chooseKeep(g,next);
  }
  if(action==='ignore'){
   if(!ignored[g.id]){
    if(g.items.some(s=>decisions[s.id]||notes[s.id])&&!confirm('Ignorer ce groupe ? Les décisions de garder/supprimer seront effacées, mais pas tes notes.'))return;
    for(const s of g.items)delete decisions[s.id];
    ignored[g.id]=true;
   }else delete ignored[g.id];
   save();render();
  }
  if(action==='batch'){
   const keep=g.items.find(s=>decisions[s.id]==='keep');
   if(!keep)return;
   const warning=g.kind==='variant'?' ATTENTION : certaines peuvent être des versions live, acoustiques ou des éditions distinctes.':'';
   if(!confirm('Garder « '+keep.Name+' » et marquer les '+(g.items.length-1)+' autres entrées à supprimer ?'+warning))return;
   for(const s of g.items)if(s.id!==keep.id)decisions[s.id]='delete';
   save();render();
  }
 });
}
async function init(){
 try{
  const {data,error}=await sb.auth.getUser();
  if(error||!data?.user)throw new Error('Connexion propriétaire requise. Ouvre la Régie MC pour te connecter.');
  const owner=await sb.rpc('yarg_owner_whoami');
  if(owner.error)throw owner.error;
  if(owner.data!==true)throw new Error('Ce compte ne possède pas les autorisations Propriétaire.');
  $('checking').hidden=true;$('app').hidden=false;
  loadSaved();bindUI();await loadCatalogue();
 }catch(error){
  $('checking').hidden=true;$('blocked').hidden=false;$('blocked-message').textContent=error.message||'Accès indisponible.';
 }
}
init();
