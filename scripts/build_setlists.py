#!/usr/bin/env python3
"""Rebuild an independently sourced, auditable GH/RB song appearance reference.

Run in GitHub Actions (internet access required). We deliberately FAIL rather
than publish an incomplete/incorrect library if a source breaks.
"""
from __future__ import annotations
import argparse
from collections import defaultdict, Counter
from datetime import datetime, date, timezone
from email.utils import parsedate_to_datetime
import csv
import json
import re
from pathlib import Path
import time
import unicodedata
from urllib.parse import quote
import requests
from bs4 import BeautifulSoup

# Wikipedia maintains country-specific original disc lists and detailed RB DLC/RBN tables.
ROOT='https://en.wikipedia.org/wiki/'
SOURCES={
 'gh1':('List_of_songs_in_Guitar_Hero',40,None),
 'gh2':('List_of_songs_in_Guitar_Hero_II',55,None),
 'gh80s':('List_of_songs_in_Guitar_Hero_Encore:_Rocks_the_80s',26,None),
 'gh3':('List_of_songs_in_Guitar_Hero_III:_Legends_of_Rock',65,None),
 'gha':('List_of_songs_in_Guitar_Hero:_Aerosmith',35,None),
 'ghwt':('List_of_songs_in_Guitar_Hero_World_Tour',75,None),
 'ghm':('List_of_songs_in_Guitar_Hero:_Metallica',43,None),
 'ghsh':('List_of_songs_in_Guitar_Hero:_Smash_Hits',42,None),
 'gh5':('List_of_songs_in_Guitar_Hero_5',70,None),
 'ghvh':('List_of_songs_in_Guitar_Hero:_Van_Halen',38,None),
 'ghwor':('List_of_songs_in_Guitar_Hero:_Warriors_of_Rock',75,None),
 'bandhero':('List_of_songs_in_Band_Hero',58,None),
 'ghlive':('List_of_songs_in_Guitar_Hero_Live',35,None),
 'rbacdc':('List_of_Rock_Band_track_packs',15,'AC/DC'),
 'rb1':('List_of_songs_in_Rock_Band',52,None),
 'rb2':('List_of_songs_in_Rock_Band_2',75,None),
 'rb3':('List_of_songs_in_Rock_Band_3',73,None),
 'rb4':('List_of_songs_in_Rock_Band_4',57,None),
 'tbrb':('List_of_songs_in_The_Beatles:_Rock_Band',38,'The Beatles'),
 'lrb':('List_of_songs_in_Lego_Rock_Band',35,None),
 'gdrb':('List_of_songs_in_Green_Day:_Rock_Band',37,'Green Day'),
 'rbb':('List_of_songs_in_Rock_Band_Blitz',20,None),
}
DLC_SOURCE='List_of_downloadable_songs_for_the_Rock_Band_series'
RBN_SOURCES=['List_of_Rock_Band_Network_1.0_songs','List_of_Rock_Band_Network_2.0_songs']
# Rock Band generation per original DLC availability, rather than retrospective compatibility.
RB2_LAUNCH=date(2008,9,14)
RB3_LAUNCH=date(2010,10,26)
RB4_LAUNCH=date(2015,10,6)

SINGLE_ARTIST={'tbrb':'The Beatles','gdrb':'Green Day'}
DENY_HEADINGS=('other songs','wii version','european wii version','ghtv','soundtrack cd','track listing of soundtrack cd','gameplay','downloadable content promotion','exported set','importable content','guitar hero arcade','promotional')
REQUIRED_SONG=('song','title','track')
USER_AGENT='YARG-original-game-setlist-audit/1.0 (noncommercial personal rhythm-game catalogue; https://github.com/)'


def normalized(text):
 s=unicodedata.normalize('NFKD',str(text or '')).casefold()
 s=''.join(c for c in s if not unicodedata.combining(c))
 s=s.replace('’','').replace("'",'').replace('&',' and ')
 s=re.sub(r'\[(?:\d+|[a-z])\]', '', s)
 s=re.sub(r'\s*\((?:cover version|as made famous by[^)]*|wavegroup|cover)\)\s*',' ',s,flags=re.I)
 s=re.sub(r'\bthe\s+','',s) if False else s
 s=re.sub(r'[^a-z0-9]+',' ',s)
 return ' '.join(s.split())


def normalized_artist(a):
 s=normalized(a)
 # Conservative, known identical credit variations. No general fuzzy matching.
 aliases={
  'stevie ray vaughan and double trouble':'stevie ray vaughan',
  'the jimi hendrix experience':'jimi hendrix experience',
  'the rolling stones':'rolling stones',
  'the beatles':'beatles',
  'the police':'police',
  'the who':'who',
  'the doors':'doors',
  'the clash':'clash',
  'the offspring':'offspring',
  'the allman brothers band':'allman brothers band',
  'the edgar winter group':'edgar winter group',
  'the grateful dead':'grateful dead',
  'joan jett and the blackhearts':'joan jett the blackhearts',
  'ac dc':'ac dc',
  'motley crue':'motley crue',
  'guns n roses':'guns n roses',
  'blue oyster cult':'blue oyster cult',
  'jimi hendrix':'jimi hendrix experience',
 }
 return aliases.get(s,s)


def song_key(title,artist):return normalized(title)+'|'+normalized_artist(artist)


def cell_clean(cell):
 c=BeautifulSoup(str(cell),'html.parser')
 for el in c.select('sup,.reference,.sortkey,.sorttext,.mw-empty-elt,.noprint'):
  el.decompose()
 text=c.get_text(' ',strip=True).replace('\u00a0',' ')
 text=re.sub(r'\s+',' ',text)
 # Wikipedia usually wraps song titles in quotation marks.
 text=text.strip().strip('"“”')
 return text.strip()


def column_idx(headers,patterns):
 for i,v in enumerate(headers):
  s=normalized(v)
  if any(s==word or s.startswith(word+' ') or word in s.split() for word in patterns):return i
 return None


def heading_before(table):
 # Parsoid & MediaWiki may wrap h2/h3 in div; find previous h works for both.
 h=table.find_previous(['h2','h3','h4']);return normalized(h.get_text(' ',strip=True)) if h else ''


def table_records(table,constant_artist=None,context=''):
 rows=table.select('tr')
 if not rows:return []
 first=[];header_row=-1
 for n,row in enumerate(rows[:5]):
  th=row.find_all('th',recursive=False)
  if not th:continue
  hs=[cell_clean(x) for x in th]
  if column_idx(hs,REQUIRED_SONG) is not None:
   first=hs;header_row=n;break
 if header_row<0:return []
 title_i=column_idx(first,REQUIRED_SONG)
 artist_i=column_idx(first,('artist','band'))
 date_i=column_idx(first,('release date','release'))
 if artist_i is None and not constant_artist:return []
 songs=[];last_artist=constant_artist
 for row in rows[header_row+1:]:
  cells=row.find_all(['td','th'],recursive=False)
  if len(cells)<=title_i:continue
  title=cell_clean(cells[title_i]);artist=cell_clean(cells[artist_i]) if artist_i is not None and len(cells)>artist_i else constant_artist
  if artist and artist not in ('—','-'):last_artist=artist
  if not artist:artist=last_artist
  if not artist:continue
  if not title or normalized(title) in ('song title','song','track','total','title','song name'):continue
  if re.match(r'^(?:\d{4}|\d{1,2}\s+\w+|notes|references)$',title,re.I):continue
  # wikipedia cells can append '(Cover version)', '(Live)', leave the live version as-is.
  date_text=cell_clean(cells[date_i]) if date_i is not None and len(cells)>date_i else ''
  songs.append((title,artist,date_text))
 return songs


def is_disc_section(heading):
 if any(x in heading for x in DENY_HEADINGS):return False
 if any(x in heading for x in ['downloadable','dlc','additional tracks','additional songs','extra songs','track packs']):return False
 return True


def get_html(session, slug):
 url=ROOT+quote(slug,safe=':_()-')
 error=None
 for attempt in range(4):
  try:
   response=session.get(url,timeout=35,headers={'User-Agent':USER_AGENT,'Accept-Language':'en-US,en;q=0.8'})
   response.raise_for_status()
   if '<table' not in response.text.lower():raise RuntimeError('No tables (possibly blocked)')
   return response.text,url
  except Exception as exc:
   error=exc;time.sleep(2*(attempt+1))
 raise RuntimeError(f'Unable to load {url}: {error}')


def collect_tables(html, game, fixed_artist=None):
 soup=BeautifulSoup(html,'html.parser')
 tables=soup.select('table.wikitable')
 found={'disc':[],'dlc':[]}
 seen={'disc':set(),'dlc':set()}
 for table in tables:
  heading=heading_before(table)
  if game=='rbacdc' and 'ac dc live' not in heading:continue
  if any(x in heading for x in DENY_HEADINGS):continue
  # Some pages use generic section headings; treat as on-disc unless specifically DLC.
  kind='dlc' if any(x in heading for x in ['downloadable','dlc','pre order','preorder','rivals expansion']) else 'disc'
  if game in ('rb1','rb2','rb3') and kind=='dlc':continue
  for title,artist,dt in table_records(table,constant_artist=fixed_artist,context=heading):
   key=song_key(title,artist)
   if key not in seen[kind]:
    seen[kind].add(key);found[kind].append((title,artist,dt))
 return found


def parse_date(text):
 s=str(text).strip().replace('Sept ', 'Sep ')
 s=re.sub(r'\s*\([^)]*\)','',s)
 for fmt in ('%b %d, %Y','%B %d, %Y','%d %B %Y','%d %b %Y','%Y-%m-%d'):
  try:return datetime.strptime(s,fmt).date()
  except ValueError:pass
 return None


def category_by_rb_date(dt):
 if dt < RB2_LAUNCH:return 'rb1'
 if dt < RB3_LAUNCH:return 'rb2'
 if dt < RB4_LAUNCH:return 'rb3'
 return 'rb4'


def build(output, report, user_songs, strict=True):
 ses=requests.Session()
 games=defaultdict(dict); audit=[];sources={}
 def add(game,title,artist,kind,url):
  key=song_key(title,artist)
  if not normalized(title) or not normalized_artist(artist):return
  rec=games[game].setdefault(key,{'t':title,'a':artist,'k':[]})
  if kind not in rec['k']:rec['k'].append(kind)
 for game,(slug,minimum,fixed_artist) in SOURCES.items():
  html,url=get_html(ses,slug)
  sources[game]=url
  records=collect_tables(html,game,fixed_artist)
  for kind in ('disc','dlc'):
   for title,artist,_ in records[kind]:add(game,title,artist,kind,url)
  disc_count=len(records['disc'])
  audit.append([game,'disc',disc_count,minimum,url,'OK' if disc_count>=minimum else 'ANOMALIE'])
  if game=='gh1' and strict and disc_count != 47:
   raise RuntimeError(f'REFUS DE PUBLIER : Guitar Hero 1 doit contenir 47 chansons, reçu {disc_count}')
  if disc_count<minimum and strict:
   raise RuntimeError(f'REFUS DE PUBLIER : {game} : {disc_count} titres sur disque, minimum {minimum}; URL={url}')
  print(f'{game}: disc={disc_count}, dlc={len(records["dlc"])}')
  time.sleep(.2)
 # Nintendo DS Guitar Hero On Tour spinoffs (region-specific NA columns).
 ot_slug='List_of_songs_in_the_Guitar_Hero:_On_Tour_series'
 html,ot_url=get_html(ses,ot_slug)
 sources['ghontour']=sources['ghdecades']=sources['ghmodern']=ot_url
 ot_soup=BeautifulSoup(html,'html.parser')
 ot_counts=Counter()
 for table in ot_soup.select('table.wikitable'):
  heading=heading_before(table)
  game='ghmodern' if 'modern hits' in heading else 'ghdecades' if 'decades' in heading else 'ghontour' if 'on tour' in heading else None
  if not game:continue
  rows=table.select('tr');header=None;headidx=None
  for i,row in enumerate(rows[:5]):
   headers=[cell_clean(c) for c in row.find_all('th',recursive=False)]
   if column_idx(headers,REQUIRED_SONG) is not None:
    header=headers;headidx=i;break
  if header is None:continue
  t_i=column_idx(header,REQUIRED_SONG);a_i=column_idx(header,('artist','band'))
  # NA/UK/AUS/JPN/NL or North American version, both considered North American.
  na_i=next((i for i,h in enumerate(header) if 'north american' in normalized(h) or normalized(h).startswith('na uk')),None)
  if na_i is None or a_i is None:continue
  for row in rows[headidx+1:]:
   cells=row.find_all(['td','th'],recursive=False)
   if len(cells)<=max(t_i,a_i,na_i):continue
   na=normalized(cell_clean(cells[na_i]))
   if na in ('na','n a','not available','none','') or na.startswith('n a'):continue
   title=cell_clean(cells[t_i]);artist=cell_clean(cells[a_i])
   if not title or not artist:continue
   add(game,title,artist,'disc',ot_url);ot_counts[game]+=1
 for game,minimum in [('ghontour',22),('ghdecades',23),('ghmodern',24)]:
  count=len(games[game]);audit.append([game,'disc NA',count,minimum,ot_url,'OK' if count>=minimum else 'ANOMALIE'])
  if strict and count<minimum:raise RuntimeError(f'REFUS DE PUBLIER : {game} {count} titres NA, minimum {minimum}')
  print(game, count)
 # Primary release DLC catalog covers the *entire* Rock Band history.
 html,dlc_url=get_html(ses,DLC_SOURCE)
 sources['rbdlc']=dlc_url
 soup=BeautifulSoup(html,'html.parser')
 dlc_rows=[]
 for table in soup.select('table.wikitable'):
  for title,artist,release in table_records(table):
   date_val=parse_date(release)
   if date_val:dlc_rows.append((title,artist,date_val))
 dlc_unique={(song_key(t,a), d):(t,a,d) for t,a,d in dlc_rows}
 for title,artist,dt in dlc_unique.values():add(category_by_rb_date(dt),title,artist,'dlc',dlc_url)
 audit.append(['rbdlc','DLC',len(dlc_unique),1800,dlc_url,'OK' if len(dlc_unique)>=1800 else 'ANOMALIE'])
 if len(dlc_unique)<1800 and strict:raise RuntimeError(f'REFUS DE PUBLIER : Rock Band DLC {len(dlc_unique)} trouvées, minimum 1800')
 print(f'Rock Band DLC: {len(dlc_unique)} released songs')
 # RBN is treated as *its own* filter, never double-count as regular RB DLC.
 for slug in RBN_SOURCES:
  html,url=get_html(ses,slug)
  sources[slug]=url
  soup=BeautifulSoup(html,'html.parser')
  rows=[]
  for table in soup.select('table.wikitable'):
   for title,artist,_ in table_records(table):rows.append((title,artist))
  for title,artist in rows:add('rbn',title,artist,'network',url)
  audit.append([slug,'network',len(rows),250,url,'OK' if len(rows)>=250 else 'ANOMALIE'])
  if len(rows)<250 and strict:raise RuntimeError(f'REFUS DE PUBLIER : RBN {slug} {len(rows)} titres, minimum 250')
  print(f'{slug} {len(rows)} songs')
 # Produce stable reference independent of user's current YARG export.
 output.parent.mkdir(parents=True,exist_ok=True)
 out={'schema':'yarg-original-game-setlists-v2','coverage':'complete','generated':datetime.now(timezone.utc).strftime('%Y-%m-%d'),
      'description':'Original US/Canada disc tracklists and time-of-release DLC, by title+artist (not a claim about chart provenance).',
      'sources':sources,'games':{g:sorted(v.values(),key=lambda x:(normalized_artist(x['a']),normalized(x['t']))) for g,v in sorted(games.items())}}
 # Avoid overwriting a good file before all thresholds have passed.
 output.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 # Verify YARG matches, identify previously mislabeled track names and suspicious mismatch rows.
 if user_songs and user_songs.exists():
  tracks=json.loads(user_songs.read_text(encoding='utf-8'))
  key_by_song=defaultdict(list)
  for row in tracks:
   if isinstance(row,dict) and row.get('Name') and row.get('Artist'):
    key_by_song[song_key(row['Name'],row['Artist'])].append(row)
  with (output.parent/'official-game-audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
   wr=csv.writer(f);wr.writerow(['Jeu','Type','Artiste','Chanson originale','Correspondances YARG','Playlists YARG','Source'])
   for game,songs in sorted(out['games'].items()):
    for song in songs:
     matched=key_by_song.get(song_key(song['t'],song['a']),[])
     wr.writerow([game,','.join(song['k']),song['a'],song['t'],len(matched),' ; '.join(sorted({r.get('Playlist','') for r in matched})),sources.get(game,sources.get('rbdlc',''))])
 with report.open('w',newline='',encoding='utf-8-sig') as f:
  writer=csv.writer(f);writer.writerow(['Jeu','Catégorie','Trouvés','Minimum vérification','URL source','Résultat']);writer.writerows(audit)
 print('SUCCESS:',output,'with',sum(map(len,out['games'].values())),'game memberships.')


def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='official-game-setlists.json');ap.add_argument('--report',default='official-game-source-audit.csv');ap.add_argument('--songs',default='songs.json');ap.add_argument('--allow-incomplete',action='store_true');args=ap.parse_args()
 build(Path(args.out),Path(args.report),Path(args.songs),strict=not args.allow_incomplete)
if __name__=='__main__':main()
