import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = f"{ROOT}/scripts/authoring/.work"
import json, re, difflib, unicodedata
A=json.load(open(f'{ROOT}/data/ingested/seco-avam.json'))['titles']
def norm(s):
    s=s.lower().replace('ß','ss')
    s=re.sub(r'\(.*?\)','',s)
    s=re.sub(r'\b(efz|eba|hf|bp|hfp|eidg\.?|dipl\.?|mit|fachausweis|diplom|eidgenössischem|eidgenössisch)\b','',s)
    s=re.sub(r'[^a-zäöüéèàç0-9 ]',' ',s)
    return re.sub(r'\s+',' ',s).strip()
IDX={}
for t in A:
    for k in ('de_m','de_f'):
        if t[k]: IDX.setdefault(norm(t[k]),t)
KEYS=list(IDX)
def lookup(*titles, cutoff=0.9):
    for title in titles:
        n=norm(title)
        if n in IDX: return IDX[n],'exact'
    for title in titles:
        m=difflib.get_close_matches(norm(title),KEYS,n=1,cutoff=cutoff)
        if m: return IDX[m[0]],'fuzzy:'+m[0]
    return None,None
