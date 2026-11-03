"""Expand data/entities with all berufsberatung.ch VET/HF/BP/HFP profiles and ~100 study fields.
Existing hand-curated entity files are kept (only their classification codes are corrected)."""
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = f"{ROOT}/scripts/authoring/.work"

import json, os, re, sys, glob, html, difflib
sys.path.insert(0, os.path.dirname(__file__))
from avam import lookup, norm

ENT = f"{ROOT}/data/entities"
BB = "https://www.berufsberatung.ch/de/"
METH = "https://github.com/leiffurthersocial-rgb/SwissCareerScore/blob/main/docs/methodology.md"
TODAY = "2026-11-03"
ALL = ["de", "fr", "it"]
bb = json.load(open(f"{WORK}/bb_parsed.json"))
avam = json.load(open(f"{ROOT}/data/ingested/seco-avam.json"))
CLS = avam["classification"]
dam = json.load(open(f"{ROOT}/data/ingested/bfs-dam.json"))
VET = dam["vetCertification"]["byOccupation"]
GRAD = dam["gradIncome"]
STUDY = dam["studySuccess"]["byType"]
log = {"skipped_nocode": [], "fuzzy": [], "created_occ": 0, "created_edu": 0}

# ---------------------------------------------------------------- existing entities + code corrections
existing = {json.load(open(f))["id"]: json.load(open(f)) for f in glob.glob(f"{ENT}/*.json")}
CORR = {"occ-fabe": "53222", "occ-fage": "32210", "occ-jurist": "26100", "occ-logistiker": "43200",
        "occ-maschineningenieur": "21441", "occ-pflegefachperson": "22212", "occ-polymechaniker": "72001",
        "occ-sanitaerinstallateur": "71263", "occ-zimmermann": "71151", "occ-techniker-maschinenbau": "31151",
        "occ-softwareentwickler": "25121"}
for oid, code in CORR.items():
    e = existing[oid]
    e["codes"] = {"isco08": code[:4], "chIsco19": code}
    e["meta"]["notes"] = (e["meta"].get("notes", "") + f" CH-ISCO-19 code corrected to {code} per SECO/AVAM occupation list.").strip()
for e in existing.values():
    if e["kind"] == "education" and e.get("leadsTo"):
        t = existing[e["leadsTo"][0]]
        if "isco08" in e.get("codes", {}): e["codes"] = {"isco08": t["codes"]["isco08"]}
occ_by_code = {e["codes"]["chIsco19"]: e for e in existing.values() if e["kind"] == "occupation"}
used_urls = {s["sourceUrl"] for e in existing.values() if e["kind"] == "education" for s in e["pathway"][-1:]}

# ---------------------------------------------------------------- group defaults (ISCO-2) — expert judgment
def sector(code):
    c4, c2 = code[:4], code[:2]
    O4 = {"2635": ("86-88", "Q"), "2642": ("58-63", "J"), "2651": ("90-96", "R"), "2652": ("90-96", "R"), "2653": ("90-96", "R"),
          "2654": ("90-96", "R"), "2655": ("90-96", "R"), "2656": ("58-63", "J"), "2411": ("68-75", "M"), "2412": ("64-66", "K"),
          "2413": ("64-66", "K"), "3311": ("64-66", "K"), "3312": ("64-66", "K"), "3321": ("64-66", "K"), "5141": ("90-96", "S"),
          "5142": ("90-96", "S"), "7421": ("26", "C"), "7422": ("26", "C"), "7311": ("26", "C"), "2262": ("45-47", "G"),
          "3213": ("45-47", "G"), "4221": ("77-82", "N"), "2250": ("68-75", "M"), "3240": ("68-75", "M"), "2342": ("85", "P"),
          "2310": ("85", "P"), "2320": ("85", "P"), "3422": ("90-96", "R"), "3435": ("90-96", "R"), "3521": ("58-63", "J"),
          "1411": ("55-56", "I"), "1412": ("55-56", "I"), "1431": ("90-96", "R"), "6113": ("77-82", "N"), "3434": ("55-56", "I"),
          "2622": ("84", "O"), "2621": ("90-96", "R"), "3433": ("90-96", "R"), "2636": ("90-96", "S"), "3412": ("86-88", "Q"),
          "5164": ("90-96", "S"), "3315": ("64-66", "K"), "3351": ("84", "O"), "3355": ("84", "O"), "5411": ("84", "O"),
          "2422": ("84", "O"), "3153": ("49-53", "H"), "3154": ("49-53", "H"), "3152": ("49-53", "H"), "5111": ("49-53", "H"),
          "5112": ("49-53", "H"), "4323": ("49-53", "H"), "8311": ("49-53", "H"), "8312": ("49-53", "H"), "7543": ("10-33", "C"),
          "3131": ("5-43", "D"), "7413": ("5-43", "D"), "3257": ("84", "O"), "2263": ("84", "O"), "3258": ("86-88", "Q")}
    O2 = {"11": ("5-96", "*"), "12": ("5-96", "*"), "13": ("5-43", "C"), "14": ("45-96", "*"), "21": ("68-75", "M"),
          "22": ("86-88", "Q"), "23": ("85", "P"), "24": ("68-75", "M"), "25": ("62-63", "J"), "26": ("68-75", "M"),
          "31": ("10-33", "C"), "32": ("86-88", "Q"), "33": ("5-96", "*"), "34": ("86-88", "Q"), "35": ("62-63", "J"),
          "41": ("5-96", "*"), "42": ("45-96", "*"), "43": ("5-96", "*"), "44": ("5-96", "*"), "51": ("55-56", "I"),
          "52": ("45-47", "G"), "53": ("86-88", "Q"), "54": ("84", "O"), "61": (None, "A"), "62": (None, "A"),
          "71": ("41-43", "F"), "72": ("28", "C"), "73": ("10-33", "C"), "74": ("41-43", "F"), "75": ("10-33", "C"),
          "81": ("10-33", "C"), "82": ("10-33", "C"), "83": ("49-53", "H"), "91": ("77-82", "N"), "92": (None, "A"),
          "93": ("41-43", "F"), "94": ("55-56", "I"), "95": ("45-96", "*"), "96": ("77-82", "N")}
    return O4.get(c4) or O2[c2]

MOB = {"1": (2, 1, 2), "21": (3, 3, 3), "22": (2, 1, 3), "23": (2, 0, 1), "24": (3, 2, 2), "25": (3, 3, 3), "26": (2, 1, 1),
       "31": (1, 3, 2), "32": (1, 1, 2), "33": (1, 1, 2), "34": (1, 1, 1), "35": (1, 3, 2), "4": (1, 0, 1), "51": (1, 2, 2),
       "52": (1, 0, 1), "53": (1, 1, 2), "54": (0, 0, 0), "6": (1, 2, 1), "71": (1, 3, 2), "72": (1, 3, 2), "73": (1, 3, 1),
       "74": (1, 2, 2), "75": (1, 3, 1), "8": (1, 2, 1), "9": (0, 2, 1)}
UBI = {"1": 2, "21": 2, "22": 3, "23": 3, "24": 2, "25": 2, "26": 2, "31": 2, "32": 3, "33": 3, "34": 2, "35": 2, "4": 3,
       "51": 3, "52": 3, "53": 3, "54": 3, "6": 2, "71": 3, "72": 2, "73": 1, "74": 3, "75": 2, "81": 1, "82": 1, "83": 3, "9": 3}
def grp(table, code): return table.get(code[:2], table.get(code[0]))

def rubric(value, unit, anchor, note, url=None):
    return {"value": value, "unit": unit, "sourceId": "expert-rubric", "sourceUrl": url or f"{METH}#{anchor}",
            "year": 2026, "confidence": "expert-judgment", "matchLevel": "exact", "note": note}

def stage(label, years, path, note=None, conf="measured"):
    s = {"label": label, "years": years, "sourceUrl": BB + path, "confidence": conf}
    if note: s["note"] = note
    return s

GYM = stage("Gymnasiale Maturität", 4, "bildungssystem/d/gymnasiale-maturitaetsschulen",
            "berufsberatung.ch states 3–6 years depending on canton (partly overlapping compulsory school); 4 years after compulsory school assumed.", "estimated")
EFZ_GENERIC = stage("EFZ apprenticeship in a related occupation", 3, "bildungssystem/d/lehre-efz",
                    "Admission normally requires a relevant EFZ (3 or 4 years); the shorter variant is counted.")
EFZ_BM = stage("EFZ with integrated Berufsmaturität (BM 1)", 3, "bildungssystem/d/berufsmaturitaet",
               "Typical vocational route to FH (3–4 years); Gymnasiale Matura plus one year of work experience is an alternative.")

def slugify(s):
    s = s.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"), ("é", "e"), ("è", "e"), ("à", "a"), ("ç", "c")):
        s = s.replace(a, b)
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")[:60]

def years_from(snippets, prefer=None):
    """Minimum full-time years stated in the duration snippets (optionally the part after `prefer`)."""
    vals = []
    for s in snippets:
        part = s
        if prefer:
            m = re.search(prefer + r"[^|]*?(\d+(?:[.,]\d+)?)\s*(?:(?:–|-|bis)\s*\d+(?:[.,]\d+)?)?\s*(Jahre|Jahr|Semester|Monate)", s)
            if not m: continue
            vals.append((float(m.group(1).replace(",", ".")), m.group(2)))
            continue
        for m in re.finditer(r"(\d+(?:[.,]\d+)?)\s*(?:(?:–|-|bis|oder)\s*\d+(?:[.,]\d+)?)?\s*(Jahre|Jahr|Semester|Monate)", part):
            if "Mindestalter" in part[max(0, m.start() - 20):m.start()]: continue
            vals.append((float(m.group(1).replace(",", ".")), m.group(2)))
    out = []
    for v, unit in vals:
        y = v / 2 if unit == "Semester" else v / 12 if unit == "Monate" else v
        out.append(round(y * 4) / 4)
    return out

def titles_of(url):
    h = open(f"{ROOT}/data/raw/berufsberatung/" + url.split("/de/")[1].replace("/", "_") + ".html", encoding="utf8").read()
    m = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    spans = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<span>(.*?)</span>", m.group(1), re.S)] if m else []
    return [s for s in spans if s]


# Manual CH-ISCO-19 assignments for titles missing from the SECO/AVAM crosswalk (project judgment).
MANUAL = {
 "zeichner": "31182", "ict fachfrau": "35120", "ict fachmann": "35120", "gebäudeinformatiker": "74120", "solarinstallateurin": "74110",
 "solarinstallateur": "74110", "solarmonteur": "74110", "glasbauer": "71250", "fachfrau sonnenschutz und storentechnik": "71153",
 "fachmann sonnenschutz und storentechnik": "71153", "montagepraktiker sonnenschutz und storentechnik": "71153",
 "fachmann reinigungstechnik": "91120", "praktikerin reinigungstechnik": "91120", "fachfrau bahntransport": "83120",
 "entwickler digitales business": "25122", "nautische fachfrau": "83500", "kapitänin der binnenschifffahrt": "31520",
 "lüftungsanlagenpraktikerin": "71271", "heizungspraktiker": "71261", "spenglerpraktikerin": "71262", "sanitärpraktiker": "71263",
 "elektrotechniker": "31130", "gebäudetechniker": "31122", "lebensmitteltechniker": "31190", "systemtechniker": "31152",
 "prozesstechnikerin": "31160", "medizintechnikerin": "32110", "metall und fassadenbautechniker": "31122",
 "kommunikationsdesigner": "21660", "managerin medien": "12220", "marketing und verkaufsleiter": "12210", "hotelmanager nds": "14110",
 "online marketing manager nds": "24310", "ict manager": "13300", "bauleiter": "31121", "information security manager": "25290",
 "bauführer im bauhauptgewerbe": "31121", "gipsermeister": "71230", "fachexpertin in psychiatriepflege": "22213",
 "fachexperte in onkologiepflege": "22213", "fachexperte in palliative care": "22213", "fachexpertin in nephrologiepflege": "22213",
 "fachexperte in geriatrischer und psychogeriatrischer pflege": "22213", "fachexperte respiratory care": "22213",
 "fachexperte in diabetesfachberatung": "22213", "finanzanalytikerin und vermögensverwalterin": "24130", "gastro unternehmer": "14120",
 "gastro betriebsleiterin": "14120", "krankenversicherungs experte": "33530", "fachperson krankenversicherung": "33530",
 "leiter von sozialen und sozialmedizinischen organisationen": "13440", "chemie und pharmaproduktionsleiter": "13210",
 "hausmeisterin": "51530", "trainer spitzensport": "34220", "sportartenschulleiter": "34220", "sportartenlehrerin": "34220",
 "schneesportlehrerin": "34220", "web project managerin": "25124", "lokomotivführer": "83110", "user experience user interface designer": "21660",
 "motion designer": "21660", "multimedia content creator": "21660", "wanderleiter": "51130", "kältesystem techniker": "71272",
 "elektroprojektleiter planung": "31130", "elektroprojektleiter installation und sicherheit": "31130", "telematik projektleiterin": "31140",
 "automobil serviceberater": "33220", "teamleiterin kundenservice": "42220", "kaminfeger vorarbeiter": "71330",
 "fachfrau natur und umwelt": "21330", "metallbau produktions und montageleiter": "31122", "projektleiterin sonnenschutz und storentechnik": "31122",
 "raumausstattermeister": "75340", "bereichsleiterin raumausstattung": "75340", "expertin für gesundes und nachhaltiges bauen": "31122",
 "gebäudehüllenplanerin": "71241", "gebäudehüllen meisterin": "71241", "käser und molkereimeisterin": "75130",
 "holzfachspezialist": "75220", "berufsunteroffizierin": None, "führungsperson in rettungsorganisationen": "32580",
 "gestalter im handwerk": "73190", "betriebswirtschafterin": "33390", "medientechnologe": "73220", "verpackungsdrucker": "73220",
 "fachfrau hotellerie hauswirtschaft": "51512", "praktikerin hotellerie hauswirtschaft": "51512", "dolmetscher": "26430",
 "mikrotechnikerin": "31140", "energie und umwelttechnikerin": "31190", "brau und getränketechnologe": "75100",
 "ict platform development specialist": "25220", "ict application development specialist": "25121", "holzbau bauführer": "31121",
 "gebäudeautomatikerin": "31152", "gartenbautechnikerin": "31420", "bauvorarbeiter": "31231", "zweirad assistent": "72310",
 "systemgastronomiepraktikerin": "94110", "orgelbauerin": "73120", "klavierbauerin": "73120", "blasinstrumentenbauer": "73120",
 "qualitätsfachfrau in mikrotechnik": "73113", "weinfachfrau": "52230", "medizinische kodiererin": "32520",
 "fachfrau in psychiatrischer pflege und betreuung": "32210", "führungsfachmann": None, "ai business specialist": "25112",
}
BLACKLIST_FUZZY = {"Gleisbaupraktiker", "Mikromechaniker"}

TYPE_FR = {"EFZ": "CFC", "EBA": "AFP", "HF": "ES", "BP": "BF", "HFP": "DF"}
TYPE_IT = {"EFZ": "AFC", "EBA": "CFP", "HF": "SSS", "BP": "APF", "HFP": "DPF"}

def combined(m, f, T):
    mb, fb = m.replace(" " + T, "").strip(), f.replace(" " + T, "").strip()
    if fb == mb + "in": return f"{mb}/in {T}"
    if mb.endswith("mann") and fb == mb[:-4] + "frau": return f"{mb[:-4]}frau/-mann {T}"
    if mb == fb: return f"{mb} {T}"
    return f"{fb} / {mb} {T}"

def write(e):
    json.dump(e, open(f"{ENT}/{e['id']}.json", "w"), ensure_ascii=False, indent=2)
    open(f"{ENT}/{e['id']}.json", "a").write("\n")

new_occ, new_edu = {}, {}
taken_ids = set(existing)

def unique_id(base):
    i, cand = 2, base
    while cand in taken_ids: cand, i = f"{base}-{i}", i + 1
    taken_ids.add(cand)
    return cand

def get_occupation(code, title_en, title_de, title_fr, title_it, qual, via_id, single_title_name):
    """Return occupation id for a CH-ISCO-19 code, creating it if needed (one occupation per code)."""
    if code in occ_by_code:
        o = occ_by_code[code]
        if via_id not in o["trainedVia"]: o["trainedVia"].append(via_id)
        o.setdefault("_titles", set()).add(title_de)
        return o["id"]
    c2 = code[:2]
    besta, noga = sector(code)
    rec, lang, tr = grp(MOB, code)
    cls = CLS.get(code) or CLS.get(code[:4]) or {"de": title_de, "fr": "", "it": ""}
    clean = lambda s: re.sub(r",?\s*(onA|sip|s\.a\.i\.)\s*$", "", s or "").strip()
    oid = unique_id("occ-" + slugify(single_title_name))
    refs = {"qualLevel": qual, "nogaSection": noga}
    if besta: refs["besta"] = besta
    o = {"id": oid, "kind": "occupation", "route": "vocational" if qual != "higherEducation" else "academic",
         "name": {"en": title_en or clean(cls["de"]), "de": title_de, "fr": title_fr or clean(cls["fr"]) or None, "it": title_it or clean(cls["it"]) or None},
         "codes": {"isco08": code[:4], "chIsco19": code},
         "sector": f"CH-ISCO-19 {code[:2]}: {clean(CLS.get(code[:2], {}).get('de', ''))}"[:80],
         "refs": refs, "pathway": [], "leadsTo": [], "trainedVia": [via_id], "languageRegions": ALL,
         "raw": {"mobility": rubric(rec + lang + tr, "rubric 0–9", "11-international-mobility",
                                    f"ISCO group default (not individually assessed): recognition {rec}/3, language independence {lang}/3, transferability {tr}/3."),
                 "regionalUbiquity": rubric(grp(UBI, code), "rubric 0–3", "12-regional-availability", "ISCO group default (not individually assessed).")},
         "meta": {"addedBy": "generated-expansion", "reviewed": TODAY,
                  "notes": f"Occupation = CH-ISCO-19 occupation type {code} ({clean(cls['de'])}). Sector for demand/telework/hours assigned from the occupation group (estimate)."},
         "_titles": {title_de}, "_cls": clean(cls["de"]), "_noga_total": noga == "*"}
    occ_by_code[code] = o
    new_occ[oid] = o
    return oid

# ---------------------------------------------------------------- 1) VET / HF / BP / HFP from berufsberatung.ch
for url, info in bb.items():
    m = re.search(r"/de/berufe/(.*)-(efz|eba|hf|bp|hfp)$", url)
    if not m or url in used_urls: continue
    stem, T = m.group(1), m.group(2).upper()
    ts = titles_of(url)
    if not ts: continue
    tm, tf = (ts + ts)[:2]
    clean_t = [re.sub(r"^(dipl\.|Dipl\.)\s*", "", t) for t in ts]
    hit, q = lookup(*clean_t, cutoff=0.9)
    if hit and q != "exact" and hit["de_m"] in BLACKLIST_FUZZY: hit, q = None, None
    if not hit:
        mc = next((MANUAL[norm(t)] for t in clean_t if norm(t) in MANUAL), None)
        if mc and (mc in CLS):
            hit, q = {"code": mc, "de_m": clean_t[0], "en": None, "fr_m": None, "it_m": None}, "manual"
    if not hit:
        log["skipped_nocode"].append(f"{T} {tm}"); continue
    if q != "exact": log["fuzzy"].append(f"{tm} -> {hit['de_m']} ({hit['code']})")
    code = hit["code"]
    if code[:1] == "0" or code[1] == "0" or len(code) != 5: log["skipped_nocode"].append(f"{T} {tm} (code {code})"); continue
    ys = years_from(info["durations"])
    de_name = combined(clean_t[0], clean_t[-1], T) if len(clean_t) > 1 else clean_t[0]
    # masculine form = the one equal to AVAM de_m when possible
    eid = unique_id(f"edu-{T.lower()}-{slugify(stem)}")
    qual = "apprenticeship" if T in ("EFZ", "EBA") else "higherVet"
    occ_name_de = re.sub(r"\s+(EFZ|EBA|HF|BP|HFP)$", "", de_name).replace("/in", "/in").strip()
    oid = get_occupation(code, hit.get("en"), occ_name_de, hit.get("fr_m"), hit.get("it_m"), qual, eid, stem)
    if T in ("EFZ", "EBA"):
        path = [stage(de_name, ys[0], url.split("/de/")[1])] if ys else []
        access = rubric(1, "rubric 0–3", "6-entry-competition", "Apprenticeship contract with a training company required (default for dual VET).", url)
    elif T == "HF":
        path = [] if not ys else [EFZ_GENERIC] + ([stage(de_name, ys[0], url.split("/de/")[1], "Full-time minimum; part-time variants take longer.")] if ys else [])
        a = 2 if code[:2] in ("22", "32") else 1
        access = rubric(a, "rubric 0–3", "6-entry-competition",
                        "HF entrance procedure" + (" with aptitude assessment and training contract (health)." if a == 2 else " (relevant EFZ required)."), url)
    else:
        lab = "Preparation for the federal exam" if T == "BP" else "Preparation for the advanced federal exam"
        path = [] if not ys else [EFZ_GENERIC] + ([stage(f"{lab}: {de_name}", ys[0], url.split("/de/")[1],
                 "Duration of the preparatory course as stated; admission also requires professional experience (see exam regulations), so the true time to qualify is longer.", "estimated")] if ys else [])
        access = rubric(0, "rubric 0–3", "6-entry-competition", "Admission to the federal exam is based on professional experience; no capacity limit.", url)
    refs = {"qualLevel": qual}
    o = new_occ.get(oid) or occ_by_code[code]
    if o["refs"].get("besta"): refs["besta"] = o["refs"]["besta"]
    refs["nogaSection"] = o["refs"]["nogaSection"]
    vet_name = None
    if T in ("EFZ", "EBA"):
        cands = {norm(k.replace("/in", "").replace("/-frau", "").replace("/-euse", "").replace("/-technologin", "")): k for k in VET}
        for t in clean_t:
            n = norm(t)
            if n in cands: vet_name = cands[n]; break
        if not vet_name:
            mm = difflib.get_close_matches(norm(clean_t[0]), list(cands), n=1, cutoff=0.93)
            if mm: vet_name = cands[mm[0]]
        if vet_name: refs["vetName"] = vet_name
    if not path:
        note = "No duration statement found on berufsberatung.ch — time to qualify is missing (null)."
    e = {"id": eid, "kind": "education", "route": "vocational", "eduType": T,
         "name": {"en": f"{hit['en']} ({T})" if hit.get("en") else de_name, "de": de_name,
                  "fr": f"{hit['fr_m']} {TYPE_FR[T]}" if hit.get("fr_m") else None, "it": f"{hit['it_m']} {TYPE_IT[T]}" if hit.get("it_m") else None},
         "codes": {"isco08": code[:4]}, "sector": o["sector"], "refs": refs, "pathway": path,
         "leadsTo": [oid], "trainedVia": [], "languageRegions": ALL,
         "raw": {"entryAccess": access},
         "meta": {"addedBy": "generated-expansion", "reviewed": TODAY,
                  "notes": ("Language regions assumed (all three) — not individually verified. " if T else "") +
                           ("" if path else "No duration statement found on berufsberatung.ch — time to qualify is missing. ") +
                           ("" if T not in ("EFZ", "EBA") or vet_name else "No BFS completion statistic for this occupation (missing).")}}
    if q == "manual": e["meta"]["notes"] += f" Occupation code {code} assigned by the project (title not in the SECO/AVAM list) — estimate."
    elif q != "exact": e["meta"]["notes"] += f" Occupation code matched approximately to SECO title '{hit['de_m']}'."
    new_edu[eid] = e

# ---------------------------------------------------------------- 2) Study fields (curated)
G = {"G": "Geistes- und Sozialwissenschaften", "W": "Wirtschaftswissenschaften", "R": "Recht", "N": "Exakte und Naturwissenschaften",
     "M": "Medizin und Pharmazie", "T": "Technische Wissenschaften", "I": "Interdisziplinäre und andere"}
GI = {**G, "I": "Interdisziplinäre und Andere"}
FHGRAD = {"Architektur, Bauwesen und Plannung": "Architektur, Bau- und Planungswesen", "Land- und Fortwirtschaft": "Land- und Forstwirtschaft"}
AB, TI, CL, LF, WD, DS, SP, MK, AL, SA, AP, GE = ("Architektur, Bauwesen und Plannung", "Technik und IT", "Chemie und Life Sciences",
    "Land- und Fortwirtschaft", "Wirtschaft und Dienstleistungen", "Design", "Sport", "Musik, Theater und andere Künste",
    "Angewandte Linguistik", "Soziale Arbeit", "Angewandte Psychologie", "Gesundheit")
DF = ["de", "fr"]
# slug: (variants, code5, occ_en, occ_de, uh_group, fh_field, langs, access{variant: (v, note)})
S = {
 "mathematik": ("U", "21200", "Mathematician / statistician", "Mathematiker/in, Statistiker/in", "N", None, DF, {}),
 "physik": ("U", "21110", "Physicist", "Physiker/in", "N", None, DF, {}),
 "chemie": ("UF", "21130", "Chemist", "Chemiker/in", "N", CL, DF, {}),
 "erdwissenschaften": ("U", "21140", "Geologist / earth scientist", "Geologe/Geologin", "N", None, DF, {}),
 "biochemie": ("U", "21310", None, None, "N", None, DF, {}),
 "biomedizinische-wissenschaften": ("U", "21310", None, None, "N", None, DF, {}),
 "forensische-wissenschaften": ("U", "21130", None, None, "N", None, ["fr"], {}),
 "geographie": ("U", "26320", "Geographer / social scientist", "Geograf/in, Sozialwissenschaftler/in", "N", None, ALL, {}),
 "rechnergestuetzte-wissenschaften": ("E", "25111", "Systems analyst / computational scientist", "Systemanalytiker/in", "N", None, ["de"], {}),
 "umweltingenieurwissenschaften": ("EF", "21430", "Environmental engineer", "Umweltingenieur/in", "T", CL, DF, {}),
 "wirtschaftsingenieurwesen": ("F", "21410", "Industrial / process engineer", "Wirtschaftsingenieur/in", None, TI, ALL, {}),
 "wirtschaftsinformatik": ("UF", "25122", "Business informatics specialist", "Wirtschaftsinformatiker/in", "W", WD, ALL, {}),
 "systemtechnik": ("F", "21442", "Mechatronics / systems engineer", "Systemtechnik-Ingenieur/in", None, TI, ALL, {}),
 "mechatronik": ("F", "21442", None, None, None, TI, ALL, {}),
 "raumplanung-geomatik": ("EF", "21640", "Spatial / transport planner", "Raumplaner/in", "T", AB, DF, {}),
 "maschineningenieurwissenschaften": ("E", "21441", None, None, "T", None, DF, {}),
 "kommunikation-medien": ("UF", "24320", "Communication / PR specialist", "Kommunikationsfachperson", "G", AL, ALL, {}),
 "gebaeudetechnik": ("F", "21490", "Building services engineer", "Gebäudetechnik-Ingenieur/in", None, AB, DF, {}),
 "elektrotechnik-informationstechnologie": ("F", "21510", None, None, None, TI, ALL, {}),
 "biotechnologie": ("F", "21450", "Bioprocess / chemical engineer", "Biotechnologe/-technologin", None, CL, DF, {}),
 "bauingenieurwissenschaften": ("F", "21420", None, None, None, AB, ALL, {}),
 "aviatik": ("F", "21490", "Aviation engineer", "Aviatik-Ingenieur/in", None, TI, ["de"], {}),
 "betriebswirtschaft": ("U", "24210", None, None, "W", None, ALL, {}),
 "computerlinguistik": ("U", "25190", "Computational linguist / software analyst", "Computerlinguist/in", "G", None, ["de"], {}),
 "medizintechnik": ("F", "21490", "Medical engineer", "Medizintechnik-Ingenieur/in", None, TI, ["de"], {}),
 "mikrotechnik": ("E", "21520", "Microengineer / electronics engineer", "Mikrotechnik-Ingenieur/in", "T", None, ["fr"], {}),
 "materialwissenschaft": ("E", "21460", "Materials scientist", "Materialwissenschaftler/in", "T", None, DF, {}),
 "lebensmittelwissenschaften": ("EF", "21450", "Food scientist / technologist", "Lebensmittelingenieur/in", "T", CL, DF, {}),
 "agrarwissenschaften": ("EF", "21320", "Agronomist", "Agronom/in", "N", LF, DF, {}),
 "umweltwissenschaften-waldwissenschaften": ("EF", "21330", "Environmental / forest scientist", "Umweltwissenschaftler/in", "N", LF, DF, {}),
 "architektur": ("E", "21610", None, None, "T", None, ALL, {}),
 "landschaftsarchitektur": ("F", "21620", "Landscape architect", "Landschaftsarchitekt/in", None, AB, DF, {}),
 "innenarchitektur": ("F", "21610", None, None, None, DS, ["de"], {"F": (2, "Portfolio and aptitude assessment.")}),
 "holztechnik": ("F", "21490", "Timber engineer", "Holzingenieur/in", None, AB, DF, {}),
 "informationswissenschaft": ("F", "26220", "Information / library scientist", "Informationswissenschaftler/in", None, WD, DF, {}),
 "tourismus": ("F", "14300", "Tourism manager", "Tourismusfachperson (FH)", None, WD, ALL, {}),
 "hospitality-management": ("F", "14110", "Hotel manager", "Hotelmanager/in", None, WD, DF, {"F": (1, "Application and selection; private schools charge substantial tuition fees.")}),
 "facility-management": ("F", "33390", "Facility manager", "Facility Manager/in", None, WD, ["de"], {}),
 "wirtschaftsrecht": None,
 "ergotherapie": ("F", "22691", "Occupational therapist", "Ergotherapeut/in", None, GE, DF, {"F": (2, "Aptitude assessment, limited places.")}),
 "hebamme": ("F", "22220", "Midwife", "Hebamme / Entbindungspfleger", None, GE, DF, {"F": (2, "Aptitude assessment, limited places.")}),
 "ernaehrung-und-diaetetik": ("F", "22650", "Dietitian", "Ernährungsberater/in", None, GE, DF, {"F": (2, "Aptitude assessment, limited places.")}),
 "medizinisch-technische-radiologie": ("F", "32110", "Radiographer", "Radiologiefachperson", None, GE, ALL, {"F": (2, "Aptitude assessment, limited places.")}),
 "osteopathie": ("F", "22690", "Osteopath", "Osteopath/in", None, GE, ["fr"], {"F": (3, "Single programme (HES-SO) with strongly limited places.")}),
 "optometrie": ("F", "22670", "Optometrist", "Optometrist/in", None, GE, ["de"], {}),
 "logopaedie": ("F", "22660", "Speech and language therapist", "Logopäde/Logopädin", None, None, ALL, {"F": (2, "Aptitude assessment, limited places.")}),
 "psychomotoriktherapie": ("F", "22690", "Psychomotor therapist", "Psychomotoriktherapeut/in", None, None, DF, {"F": (2, "Aptitude assessment, limited places.")}),
 "pflege-pflegewissenschaft": ("U", "22213", "Advanced practice nurse", "Pflegeexperte/-expertin APN", "I", None, DF, {}),
 "gesundheitswissenschaften": ("U", "22630", "Public health specialist", "Gesundheitswissenschaftler/in", "I", None, DF, {}),
 "chiropraktik": ("M", "22690", "Chiropractor", "Chiropraktor/in", "M", None, ["de"], {"M": (3, "Numerus clausus together with human medicine (aptitude test).")}),
 "zahnmedizin": ("M", "22610", "Dentist", "Zahnarzt/Zahnärztin", "M", None, DF, {"M": (3, "Numerus clausus (aptitude test).")}),
 "veterinaermedizin": ("M", "22500", "Veterinarian", "Tierarzt/Tierärztin", "M", None, DF, {"M": (3, "Numerus clausus (aptitude test).")}),
 "pharmazie": ("M", "22620", "Pharmacist", "Apotheker/in", "M", None, DF, {}),
 "psychologie": ("F", "26340", None, None, None, AP, DF, {"F": (2, "Aptitude assessment at FH applied psychology.")}),
 "soziologie": ("U", "26320", "Sociologist", "Soziologe/Soziologin", "G", None, DF, {}),
 "sozialanthropologie-kulturanthropologie": ("U", "26320", None, None, "G", None, DF, {}),
 "religionswissenschaft": ("U", "26320", None, None, "G", None, DF, {}),
 "gender-studies": ("U", "26320", None, None, "G", None, DF, {}),
 "politikwissenschaft": ("U", "26330", "Political scientist", "Politologe/Politologin", "G", None, DF, {}),
 "internationale-studien": ("U", "24220", "Policy / strategy specialist", "Fachperson Internationale Beziehungen", "G", None, DF, {}),
 "geschichte": ("U", "26330", "Historian", "Historiker/in", "G", None, ALL, {}),
 "philosophie": ("U", "26330", None, None, "G", None, DF, {}),
 "kunstgeschichte": ("U", "26210", "Art historian / curator", "Kunsthistoriker/in", "G", None, ALL, {}),
 "archaeologie-aegyptologie": ("U", "26320", None, None, "G", None, DF, {}),
 "osteuropa-studien": ("U", "26330", None, None, "G", None, ["de"], {}),
 "theologie": ("U", "26360", "Theologian / pastor", "Theologe/Theologin, Pfarrer/in", "G", None, DF, {}),
 "erziehungswissenschaft": ("U", "23510", "Education scientist", "Erziehungswissenschaftler/in", "G", None, DF, {}),
 "musikwissenschaft": ("U", "26330", None, None, "G", None, DF, {}),
 "filmwissenschaft": ("U", "26540", "Film / media professional", "Film- und Medienschaffende/r", "G", None, ["de"], {}),
 "theaterwissenschaft-tanzwissenschaft": ("U", "26540", None, None, "G", None, ["de"], {}),
 "uebersetzen-dolmetschen": ("UF", "26430", "Translator / interpreter", "Übersetzer/in, Dolmetscher/in", "G", AL, DF, {}),
 "allgemeine-sprachwissenschaft": ("U", "26430", None, None, "G", None, DF, {}),
 "vergleichende-literaturwissenschaft": ("U", "26430", None, None, "G", None, DF, {}),
 "latein-griechisch": ("U", "26330", None, None, "G", None, DF, {}),
 **{k: ("U", "26430", None, None, "G", None, l, {}) for k, l in {
     "deutsche-sprach-und-literaturwissenschaft": ALL, "englische-sprach-und-literaturwissenschaft": ALL,
     "franzoesische-sprach-und-literaturwissenschaft": ALL, "italienische-sprach-und-literaturwissenschaft": ALL,
     "spanische-sprach-und-literaturwissenschaft": DF, "slavische-sprach-und-literaturwissenschaft": DF,
     "nordische-sprach-und-literaturwissenschaft": ["de"], "neugriechische-sprach-und-literaturwissenschaft": ["de"],
     "raetoromanische-sprach-und-literaturwissenschaft": ["de"], "armenische-sprach-und-literaturwissenschaft": ["fr"],
     "chinesische-sprachen-und-kulturen": DF, "japanische-sprache-und-kulturen": ["de"], "indische-sprachen-und-kulturen": ["de"],
     "islamische-kulturen-arabisch": DF, "juedische-kulturen-hebraeisch": ["de"]}.items()},
 "literarisches-schreiben": ("F", "26410", "Author / writer", "Autor/in", None, MK, DF, {"F": (3, "Admission by portfolio and interview, very few places.")}),
 "visuelle-kommunikation": ("F", "21660", None, None, None, DS, ALL, {"F": (2, "Portfolio and aptitude assessment.")}),
 "design": ("F", "21630", "Product / industrial designer", "Produktdesigner/in", None, DS, ALL, {"F": (2, "Portfolio and aptitude assessment.")}),
 "kunstvermittlung": ("F", "23550", "Art teacher / art educator", "Kunstvermittler/in", None, DS, DF, {"F": (2, "Portfolio and aptitude assessment.")}),
 "konservierung-restaurierung": ("F", "26210", None, None, None, DS, ALL, {"F": (2, "Aptitude assessment, few places.")}),
 "bildende-kunst": ("F", "26510", "Visual artist", "Bildende/r Künstler/in", None, MK, ALL, {"F": (3, "Admission by portfolio, few places.")}),
 "film": ("F", "26540", None, None, None, MK, DF, {"F": (3, "Admission by portfolio and interview, few places.")}),
 "musik": ("F", "26520", "Musician", "Musiker/in", None, MK, ALL, {"F": (3, "Entrance audition, limited places.")}),
 "theater-tanz": ("F", "26550", "Actor / dancer", "Schauspieler/in, Tänzer/in", None, MK, ALL, {"F": (3, "Entrance audition, very few places.")}),
 "sport-sportwissenschaften": ("UF", "34220", "Sports scientist / coach", "Sportwissenschaftler/in, Trainer/in", "I", SP, DF, {"F": (2, "Sports aptitude test."), "U": (2, "Sports aptitude test at most universities.")}),
 "unterricht-sekundarstufe-1": ("P", "23302", "Lower-secondary school teacher", "Lehrperson Sekundarstufe I", None, None, ALL, {}),
 "sonderpaedagogik": ("P", "23520", "Special-needs teacher", "Schulische Heilpädagogin / Heilpädagoge", None, None, DF, {}),
}
UKEY, FKEY = {"U": "Universität", "E": "ETH", "M": "Universität"}, {"F": "Fachhochschule", "P": "Pädagogische Hochschule"}

def snippets(slug): return bb.get(BB + "studienrichtungen/" + slug, {}).get("durations", [])

def study_years(slug, v):
    sn = snippets(slug)
    if v in ("U", "E", "M"):
        inst = r"(?:Universität(?:, ETH)?|ETH)"
        b = years_from(sn[:1], inst) or years_from(sn[:1])
        mm = years_from(sn[1:2], inst) or years_from(sn[1:2])
        return (b[0] if b else None), (mm[0] if mm else None)
    if v == "F":
        b = years_from(sn[:1], "Fachhochschule") or years_from(sn[:1])
        return (b[0] if b else None), None
    b = years_from(sn[:1], r"Pädagogische Hochschule") or years_from(sn[:1])
    return (b[0] if b else None), None

existing_study = {("biologie", "U"), ("informatik", "U"), ("informatik", "F"), ("informatik", "E"), ("humanmedizin", "M"),
                  ("psychologie", "U"), ("rechtswissenschaft", "U"), ("volkswirtschaft", "U"), ("physiotherapie", "F"),
                  ("soziale-arbeit", "F"), ("unterricht-vorschulstufe-primarstufe", "P"), ("bauingenieurwissenschaften", "E"),
                  ("elektrotechnik-informationstechnologie", "E"), ("architektur", "F"), ("betriebswirtschaft", "F"),
                  ("maschineningenieurwissenschaften", "F")}
for slug, spec in S.items():
    if spec is None or BB + "studienrichtungen/" + slug not in bb: continue
    variants, code, oen, ode, ug, ff, langs, acc = spec
    page = bb[BB + "studienrichtungen/" + slug]
    field_de = page["title"] or slug
    for v in variants:
        if (slug, v) in existing_study: continue
        b, mst = study_years(slug, v)
        typ = {"U": "UH-MSc", "E": "ETH-MSc", "M": "UH-MMed", "F": "FH-BSc", "P": "FH-BSc"}[v]
        inst = {"U": "UH", "E": "ETH/EPFL", "M": "UH", "F": "FH", "P": "PH"}[v]
        eid = unique_id(f"edu-{ {'U': 'uh', 'E': 'eth', 'M': 'uh', 'F': 'fh', 'P': 'ph'}[v] }-{slug}".replace(" ", ""))
        sp = "studienrichtungen/" + slug
        if v in ("U", "E", "M"):
            path = [GYM] + ([stage(f"Bachelor {field_de} ({inst})", b, sp)] if b else []) + ([stage(f"Master {field_de} ({inst})", mst, sp)] if mst else [])
            level = "Master"
        elif v == "F":
            path = [EFZ_BM] + ([stage(f"Bachelor {field_de} (FH)", b, sp)] if b else [])
            level = "Bachelor"
        else:
            path = [GYM] + ([stage(f"Studium {field_de} (PH)", b, sp, "Teaching diploma programme (bachelor and/or master as stated).")] if b else [])
        refs = {"qualLevel": "higherEducation"}
        if v in ("U", "E", "M") and ug:
            refs["studyField"] = f"UH:{G[ug]}"
            r = GRAD["uh"]["byLevel"]["Master"].get(GI[ug])
            if r and r.get("median"): refs["gradIncome"] = f"uh:Master:{GI[ug]}"
        if v == "F" and ff:
            refs["studyField"] = f"FH:{ff}"
            gk = FHGRAD.get(ff, ff)
            r = GRAD["fh"]["byLevel"]["Bachelor"].get(gk)
            if r and r.get("median"): refs["gradIncome"] = f"fh:Bachelor:{gk}"
        if v == "P":
            refs["gradIncome"] = "fh:Lehrdiplome:Lehrkräfteausbildung"
        av, an = acc.get(v, ({"U": 0, "E": 0, "M": 3, "F": 0, "P": 1}[v], {"U": "Open admission with Matura.", "E": "Open admission with Swiss Matura; selection via first-year exam.",
                              "M": "Limited places.", "F": "Admission with a relevant Berufsmaturität; no capacity limit.", "P": "Admission with Matura; some PH run aptitude assessments."}[v]))
        qual = "higherEducation"
        name_de_occ = ode or (CLS.get(code, {}).get("de") or field_de)
        oid = get_occupation(code, oen, re.sub(r",?\s*onA$", "", name_de_occ), None, None, qual, eid, slugify(ode or field_de))
        o = existing.get(oid) or new_occ.get(oid)
        if o["refs"].get("besta"): refs["besta"] = o["refs"]["besta"]
        refs["nogaSection"] = o["refs"]["nogaSection"]
        en_field = {"U": "MSc/MA", "E": "MSc", "M": "Master", "F": "BSc/BA", "P": "Teaching diploma"}[v]
        e = {"id": eid, "kind": "education", "route": "academic" if v in "UEMP" else "mixed", "eduType": typ,
             "name": {"en": f"{field_de} – {en_field} ({inst})", "de": f"{ 'Master' if v in 'UEM' else 'Bachelor' if v == 'F' else 'Lehrdiplom'} {field_de} ({inst})",
                      "fr": None, "it": None},
             "codes": {"isco08": code[:4]}, "sector": o["sector"], "refs": refs, "pathway": path,
             "leadsTo": [oid], "trainedVia": [], "languageRegions": langs,
             "raw": {"entryAccess": rubric(av, "rubric 0–3", "6-entry-competition", an, BB + sp)},
             "meta": {"addedBy": "generated-expansion", "reviewed": TODAY,
                      "notes": "English name of the field kept in German where no official translation was available. Target occupation chosen by the project as the most typical professional destination (estimate)."}}
        new_edu[eid] = e

# Upper-secondary teacher (Gymnasium): subject master + teaching diploma
eid = unique_id("edu-uh-lehrdiplom-maturitaetsschulen")
oid = get_occupation("23301", "Upper-secondary (Gymnasium) teacher", "Lehrperson Maturitätsschule", None, None, "higherEducation", eid, "gymnasiallehrperson")
o = new_occ.get(oid) or occ_by_code["23301"]
new_edu[eid] = {"id": eid, "kind": "education", "route": "academic", "eduType": "UH-MSc",
    "name": {"en": "Teaching diploma for Gymnasium (subject master + diploma)", "de": "Lehrdiplom für Maturitätsschulen (Fachmaster + Lehrdiplom)", "fr": None, "it": None},
    "codes": {"isco08": "2330"}, "sector": o["sector"], "refs": {"qualLevel": "higherEducation", "besta": o["refs"].get("besta", "85"), "nogaSection": "P", "gradIncome": "fh:Lehrdiplome:Lehrkräfteausbildung"},
    "pathway": [GYM, stage("Bachelor in a teaching subject (e.g. history)", 3, "studienrichtungen/geschichte"),
                stage("Master in the teaching subject", 2, "studienrichtungen/geschichte", "Subject-dependent; history used as reference."),
                stage("Teaching diploma (Lehrdiplom) for Maturitätsschulen", 1, "studienrichtungen/unterricht-mittelschulen-berufsfachschulen")],
    "leadsTo": [oid], "trainedVia": [], "languageRegions": ALL,
    "raw": {"entryAccess": rubric(0, "rubric 0–3", "6-entry-competition", "Open admission with a subject master.", BB + "studienrichtungen/unterricht-mittelschulen-berufsfachschulen")},
    "meta": {"addedBy": "generated-expansion", "reviewed": TODAY}}

# ---------------------------------------------------------------- write
for e in list(existing.values()) + list(new_occ.values()):
    if e["kind"] == "occupation":
        titles = e.pop("_titles", set())
        cls_name = e.pop("_cls", None)
        e.pop("_noga_total", None)
        if e["meta"]["addedBy"] == "generated-expansion" and len(titles) > 1 and cls_name:
            e["name"]["de"] = cls_name
            e["meta"]["notes"] += " Several job titles share this occupation type: " + "; ".join(sorted(titles))[:400] + "."
for e in list(existing.values()) + list(new_occ.values()) + list(new_edu.values()):
    e["meta"]["notes"] = e["meta"].get("notes", "").strip() or None
    if e["meta"]["notes"] is None: del e["meta"]["notes"]
    write(e)
print({k: (len(v) if isinstance(v, list) else v) for k, v in log.items()}, "new occ", len(new_occ), "new edu", len(new_edu))
json.dump(log, open(f"{WORK}/log.json", "w"), ensure_ascii=False, indent=1)
