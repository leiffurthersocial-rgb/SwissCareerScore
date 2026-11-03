"""Step 1: list berufsberatung.ch occupation/study profiles from the sitemap and cache them in data/raw."""
import re, os, json, urllib.request, concurrent.futures as cf
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = f"{ROOT}/data/raw/berufsberatung"
WORK = f"{ROOT}/scripts/authoring/.work"
os.makedirs(WORK, exist_ok=True)
sm = urllib.request.urlopen(urllib.request.Request("https://www.berufsberatung.ch/sitemap.xml", headers={"User-Agent": "SwissCareerScore-ingest/1.0"}), timeout=60).read().decode()
locs = re.findall(r"<loc>([^<]+)</loc>", sm)
urls = [u for u in locs if re.search(r"/de/berufe/.*-(efz|eba|hf|bp|hfp)$", u) or "/de/studienrichtungen/" in u]
def fname(u): return os.path.join(RAW, u.split("/de/")[1].replace("/", "_") + ".html")
def get(u):
    if os.path.exists(fname(u)) and os.path.getsize(fname(u)) > 5000: return True
    for _ in range(3):
        try:
            open(fname(u), "wb").write(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "SwissCareerScore-ingest/1.0"}), timeout=40).read())
            return True
        except Exception:
            pass
    return False
os.makedirs(RAW, exist_ok=True)
with cf.ThreadPoolExecutor(8) as ex: ok = sum(ex.map(get, urls))
json.dump(urls, open(f"{WORK}/urls.json", "w"))
print(len(urls), "profiles,", ok, "cached")
