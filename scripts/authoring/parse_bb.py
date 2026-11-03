import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = f"{ROOT}/scripts/authoring/.work"
import re, os, html, json
RAW=f"{ROOT}/data/raw/berufsberatung"
urls=json.load(open(f'{WORK}/urls.json'))
def text(h):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',h,flags=re.S)
    t=html.unescape(re.sub(r'<[^>]+>','\n',t)); return re.sub(r'\n\s*\n+','\n',t)
out={}
for u in urls:
    h=open(os.path.join(RAW,u.split('/de/')[1].replace('/','_')+'.html'),encoding='utf8').read()
    t=text(h)
    title=re.search(r'<h1[^>]*>(.*?)</h1>',h,re.S)
    title=html.unescape(re.sub(r'<[^>]+>','',title.group(1))).strip() if title else None
    durs=[]
    for m in re.finditer(r'Dauer:?\s*\n([^\n]+(?:\n[^\n]+){0,3})',t):
        lines=[x.strip() for x in m.group(1).split('\n') if x.strip()]
        keep=[l for l in lines if re.search(r'\d',l) and re.search(r'Jahr|Vollzeit|Semester|Monat',l)]
        if keep: durs.append(' | '.join(keep))
    wages=re.findall(r'(\d)\. Lehrjahr: CHF ([\d’\'–\-. ]+)',t)
    # short description: first paragraph after title-ish
    desc=None
    m=re.search(r'<meta name="description" content="([^"]*)"',h)
    if m: desc=html.unescape(m.group(1)).strip()
    out[u]={'title':title,'durations':durs,'wages':wages,'desc':desc}
json.dump(out,open(f'{WORK}/bb_parsed.json','w'),ensure_ascii=False,indent=0)
import collections
c=collections.Counter('ok' if v['durations'] else 'nodur' for v in out.values()); print(c)
for u in list(out)[:3]+[x for x in out if 'studienrichtungen' in x][:2]+[x for x in out if x.endswith('-bp')][:3]: print(u.split('/de/')[1], out[u]['title'], out[u]['durations'][:2])
