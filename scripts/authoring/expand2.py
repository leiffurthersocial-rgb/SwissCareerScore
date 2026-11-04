"""Second expansion pass (run after expand.py):
 1. graduate-survey field keys (ILO unemployment) for UH/FH paths
 2. baseline paths: direct entry without qualification, Gymnasiale Matura, Fachmittelschule + Fachmaturität
 3. FH master's degrees, doctorates by field group
 4. every remaining CH-ISCO-19 occupation type (also those without a standard training path)
Idempotent: existing ids are overwritten with the same content."""
import json, os, re, glob, sys
sys.path.insert(0, os.path.dirname(__file__))
from defaults import sector, MOB, UBI, grp

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENT = f"{ROOT}/data/entities"
BB = "https://www.berufsberatung.ch/de/"
METH = "https://github.com/leiffurthersocial-rgb/SwissCareerScore/blob/main/docs/methodology.md"
BFS_DUR = "https://www.bfs.admin.ch/asset/de/5566823"
TODAY = "2026-11-04"
ALL = ["de", "fr", "it"]
avam = json.load(open(f"{ROOT}/data/ingested/seco-avam.json"))
CLS = avam["classification"]
dam = json.load(open(f"{ROOT}/data/ingested/bfs-dam.json"))
ents = {json.load(open(f))["id"]: json.load(open(f)) for f in glob.glob(f"{ENT}/*.json")}

def write(e):
    with open(f"{ENT}/{e['id']}.json", "w") as fh:
        json.dump(e, fh, ensure_ascii=False, indent=2); fh.write("\n")
    ents[e["id"]] = e

def rubric(value, unit, anchor, note, url=None):
    return {"value": value, "unit": unit, "sourceId": "expert-rubric", "sourceUrl": url or f"{METH}#{anchor}",
            "year": 2026, "confidence": "expert-judgment", "matchLevel": "exact", "note": note}

def stage(label, years, url, note=None, conf="measured"):
    s = {"label": label, "years": years, "sourceUrl": url if url.startswith("http") else BB + url, "confidence": conf}
    if note: s["note"] = note
    return s

GYM = stage("Gymnasiale Maturität", 4, "bildungssystem/d/gymnasiale-maturitaetsschulen",
            "berufsberatung.ch states 3–6 years depending on canton (partly overlapping compulsory school); 4 years after compulsory school assumed.", "estimated")
EFZ_BM = stage("EFZ with integrated Berufsmaturität (BM 1)", 3, "bildungssystem/d/berufsmaturitaet",
               "Typical vocational route to FH (3–4 years); Gymnasiale Matura plus one year of work experience is an alternative.")
clean = lambda s: re.sub(r",?\s*(onA|sip|s\.a\.i\.)\s*$", "", s or "").strip()

# ------------------------------------------------------------- 1) ISCED field keys for graduate unemployment
UHF = dam["gradUnemployment"]["UH Master"]; FHF = dam["gradUnemployment"]["FH Bachelor"]
RULES = [  # (substring of id, UH field, FH field)
    (("medizin", "zahnmedizin", "pharmazie", "chiropraktik", "pflege", "gesundheitswiss", "physio", "ergotherapie", "hebamme",
      "ernaehrung", "radiologie", "osteopathie", "optometrie", "logopaedie", "psychomotorik"), "Gesundheit", "Gesundheit"),
    (("veterinaer",), "Tiermedizin", None),
    (("mlaw", "rechtswiss"), "Recht", "Recht"),
    (("soziale-arbeit",), None, "Sozialwesen"),
    (("informatik", "rechnergestuetzte", "computerlinguistik"), "Informations- und Kommunikationstechnologie", "Informations- und Kommunikationstechnologie"),
    (("bauingenieur", "architektur", "raumplanung", "landschaftsarchitektur", "gebaeudetechnik", "holztechnik", "innenarchitektur"), "Architektur und Baugewerbe", "Architektur und Baugewerbe"),
    (("elektrotechnik", "maschinen", "mikrotechnik", "materialwiss", "umweltingenieur", "lebensmittel", "systemtechnik", "mechatronik",
      "wirtschaftsingenieur", "aviatik", "medizintechnik", "biotechnologie", "chemie"), "Ingenieurwesen und Technische Berufe", "Ingenieurwesen und Technische Berufe"),
    (("biologie", "biochemie", "biomedizin"), "Biologie und verwandte Wissenschaften", "Biologie und verwandte Wissenschaften"),
    (("umweltwissenschaften",), "Umwelt", "Umwelt"),
    (("agrarwiss",), "Landwirtschaft", "Landwirtschaft"),
    (("mathematik",), "Mathematik und Statistik", None),
    (("physik", "erdwissenschaften", "forensische", "geographie"), "Exakte Naturwissenschaften", None),
    (("economics", "betriebswirtschaft", "betriebsoekonomie", "wirtschaftsinformatik", "tourismus", "hospitality", "facility"), "Wirtschaft und Verwaltung", "Wirtschaft und Verwaltung"),
    (("kommunikation-medien", "informationswissenschaft"), "Journalismus und Informationswesen", "Journalismus und Informationswesen"),
    (("erziehungswiss", "lehrdiplom"), "Pädagogik", None),
    (("psychologie", "soziologie", "politikwiss", "internationale", "sozialanthropologie", "gender", "religionswiss"), "Sozial- und Verhaltenswissenschaften", None),
    (("sprach", "literatur", "uebersetzen", "kulturen", "chinesisch", "japanisch"), "Sprachen", "Sprachen"),
    (("geschichte", "philosophie", "kunstgeschichte", "archaeologie", "theologie", "musikwiss", "filmwiss", "theaterwiss", "latein", "osteuropa"),
     "Geisteswissenschaften (ohne Sprachen)", None),
    (("design", "visuelle", "bildende-kunst", "film", "musik", "theater-tanz", "kunstvermittlung", "konservierung", "literarisches"), "Künste", "Künste"),
]
n_field = 0
for e in list(ents.values()):
    t = e.get("eduType")
    if e["kind"] != "education" or t not in ("UH-MSc", "ETH-MSc", "UH-MMed", "FH-BSc") or e["id"].startswith("edu-ph-"): continue
    is_uh = t != "FH-BSc"
    for keys, uh, fh in RULES:
        if any(k in e["id"] for k in keys):
            f = uh if is_uh else fh
            table = UHF if is_uh else FHF
            if f and f in table:
                e["refs"]["gradField"] = f"{'uh' if is_uh else 'fh'}:{f}"; write(e); n_field += 1
            break

# ------------------------------------------------------------- helper: occupation for a code
def occupation(code, en=None, de=None, via=None, note=None, qual=None):
    existing = next((o for o in ents.values() if o["kind"] == "occupation" and o["codes"].get("chIsco19") == code), None)
    if existing:
        if via and via not in existing["trainedVia"]:
            existing["trainedVia"].append(via); write(existing)
        return existing["id"]
    c = CLS[code]
    besta, noga = sector(code)
    rec, lang, tr = grp(MOB, code)
    q = qual or ("higherEducation" if code[0] in "12" else "higherVet" if code[0] == "3" else "compulsory" if code[0] == "9" else "apprenticeship")
    titles = [t for t in avam["titles"] if t["code"] == code]
    en_name = en or (next((t["en"] for t in titles if t["en"]), None) if len(titles) == 1 else None) or clean(c["de"])
    slug = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", clean(de or c["de"]).lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")))[:50].strip("-")
    oid = f"occ-{slug}"
    i = 2
    while oid in ents: oid, i = f"occ-{slug}-{i}", i + 1
    refs = {"qualLevel": q, "nogaSection": noga}
    if besta: refs["besta"] = besta
    o = {"id": oid, "kind": "occupation", "route": "academic" if code[0] == "2" else "mixed" if code[0] == "1" else "vocational",
         "name": {"en": en_name, "de": de or clean(c["de"]), "fr": clean(c["fr"]) or None, "it": clean(c["it"]) or None},
         "codes": {"isco08": code[:4], "chIsco19": code},
         "sector": f"CH-ISCO-19 {code[:2]}: {clean(CLS.get(code[:2], {}).get('de', ''))}"[:80],
         "refs": refs, "pathway": [], "leadsTo": [], "trainedVia": [via] if via else [], "languageRegions": ALL,
         "raw": {"mobility": rubric(rec + lang + tr, "rubric 0–9", "11-international-mobility",
                                    f"ISCO group default (not individually assessed): recognition {rec}/3, language independence {lang}/3, transferability {tr}/3."),
                 "regionalUbiquity": rubric(grp(UBI, code), "rubric 0–3", "12-regional-availability", "ISCO group default (not individually assessed).")},
         "meta": {"addedBy": "generated-expansion-2", "reviewed": TODAY,
                  "notes": note or f"Official CH-ISCO-19 occupation type {code}. Sector for demand/telework/hours assigned from the occupation group (estimate)."}}
    write(o)
    return oid

# ------------------------------------------------------------- 2) baselines
write({"id": "edu-none-direkteinstieg", "kind": "education", "route": "vocational", "eduType": "NONE",
       "name": {"en": "Direct entry into work (no post-compulsory qualification)", "de": "Direkteinstieg ohne nachobligatorischen Abschluss",
                "fr": "Entrée directe dans la vie active (sans diplôme post-obligatoire)", "it": "Ingresso diretto nel mondo del lavoro (senza titolo post-obbligatorio)"},
       "codes": {}, "sector": "Whole economy", "refs": {"lseEducation": "8", "eduLevel": "Sekundarstufe I", "directEntry": True, "besta": "5-96",
                                                       "qualLevel": "compulsory", "nogaSection": "*"},
       "pathway": [], "leadsTo": [], "trainedVia": [], "languageRegions": ALL,
       "raw": {"entryAccess": rubric(0, "rubric 0–3", "6-entry-competition", "No admission requirement."),
               "mobility": rubric(1, "rubric 0–9", "11-international-mobility", "No recognised qualification to take abroad; unskilled work is available but poorly paid."),
               "regionalUbiquity": rubric(6, "rubric 0–6", "12-regional-availability", "Unskilled jobs exist everywhere.")},
       "meta": {"addedBy": "generated-expansion-2", "reviewed": TODAY,
                "notes": "Baseline for comparison. Pay: LSE 2024 for people whose highest education is compulsory school; unemployment: SECO by education level. AI exposure and career growth have no education-level statistic (missing)."}})
for eid, T, en, de, fr, it, path, note in [
    ("edu-gym-matura", "GYM", "Gymnasiale Matura (entering work with Matura only)", "Gymnasiale Maturität (Berufseinstieg nur mit Matura)",
     "Maturité gymnasiale (entrée dans la vie active avec la maturité)", "Maturità liceale (ingresso nel lavoro con la sola maturità)",
     [stage("Gymnasiale Maturität", 4, "bildungssystem/d/gymnasiale-maturitaetsschulen",
            "berufsberatung.ch states 3–6 years depending on canton (partly overlapping compulsory school); 4 years after compulsory school assumed.", "estimated")],
     "Mainly a gateway to university; scored here as a terminal qualification for comparison. LSE pools Gymnasiale and Berufsmaturität."),
    ("edu-fms-fachmaturitaet", "FMS", "Specialised baccalaureate (Fachmittelschule + Fachmaturität)", "Fachmittelschule und Fachmaturität",
     "École de culture générale et maturité spécialisée", "Scuola specializzata e maturità specializzata",
     [stage("Fachmittelschule (FMS)", 3, "bildungssystem/d/fachmittelschulen"), stage("Fachmaturität", 1, "bildungssystem/d/fachmaturitaet")],
     "Gateway to FH/PH programmes in health, social work, education and arts; scored here as a terminal qualification. LSE pools it with Matura/BM."),
]:
    write({"id": eid, "kind": "education", "route": "academic" if T == "GYM" else "mixed", "eduType": T,
           "name": {"en": en, "de": de, "fr": fr, "it": it}, "codes": {}, "sector": "Whole economy",
           "refs": {"lseEducation": "5", "eduLevel": "Sekundarstufe II", "nogaSection": "*"},
           "pathway": path, "leadsTo": [], "trainedVia": [], "languageRegions": ALL,
           "raw": {"entryAccess": rubric(1, "rubric 0–3", "6-entry-competition", "Admission by school grades or entrance exam, depending on canton.",
                                         BB + path[0]["sourceUrl"].split("/de/")[1]),
                   "mobility": rubric(3, "rubric 0–9", "11-international-mobility", "General school-leaving certificate; widely recognised for study access, not as a vocational qualification."),
                   "regionalUbiquity": rubric(6, "rubric 0–6", "12-regional-availability", "Offered in every canton.")},
           "meta": {"addedBy": "generated-expansion-2", "reviewed": TODAY, "notes": note}})

# ------------------------------------------------------------- 3a) FH master's degrees
FHM = [  # slug, bachelor entity whose target to reuse, FH field (grad income), title
    ("informatik", "edu-fh-informatik", "Technik und IT", "Informatik / Engineering"),
    ("maschineningenieurwissenschaften", "edu-fh-maschinentechnik", "Technik und IT", "Engineering (Maschinentechnik)"),
    ("betriebswirtschaft", "edu-fh-betriebsoekonomie", "Wirtschaft und Dienstleistungen", "Business Administration"),
    ("soziale-arbeit", "edu-fh-soziale-arbeit", "Soziale Arbeit", "Soziale Arbeit"),
    ("psychologie", "edu-fh-psychologie", "Angewandte Psychologie", "Angewandte Psychologie"),
    ("pflege-pflegewissenschaft", "edu-fh-pflege", "Gesundheit", "Pflege (Advanced Practice)"),
    ("physiotherapie", "edu-fh-physio", "Gesundheit", "Physiotherapie"),
    ("design", "edu-fh-design", "Design", "Design"),
    ("musik", "edu-fh-musik", "Musik, Theater und andere Künste", "Musik (Performance/Pädagogik)"),
    ("architektur", "edu-fh-architektur", "Architektur, Bau- und Planungswesen", "Architektur"),
    ("biotechnologie", "edu-fh-biotechnologie", "Chemie und Life Sciences", "Life Sciences"),
]
bbp = json.load(open(f"{ROOT}/data/ingested/berufsberatung.json"))["pages"]
def fh_master_years(slug):
    import re as _re
    for sn in bbp.get(BB + "studienrichtungen/" + slug, {}).get("durationSnippets", [])[1:2]:
        m = _re.search(r"Fachhochschule:\s*mind\.\s*(\d+(?:,\d+)?)\s*Jahr", sn)
        if m: return float(m.group(1).replace(",", "."))
    return None
def fh_bachelor_years(slug):
    import re as _re
    for sn in bbp.get(BB + "studienrichtungen/" + slug, {}).get("durationSnippets", [])[:1]:
        m = _re.search(r"Fachhochschule:\s*mind\.\s*(\d+(?:,\d+)?)\s*Jahr", sn)
        if m: return float(m.group(1).replace(",", "."))
    return 3.0
n_fhm = 0
for slug, bach, field, title in FHM:
    if bach not in ents: continue
    my = fh_master_years(slug)
    if not my: continue
    b = ents[bach]
    target = b["leadsTo"][0]
    refs = {"qualLevel": "higherEducation", "gradIncome": f"fh:Master:{field}"}
    for k in ("besta", "nogaSection"):
        if k in b["refs"]: refs[k] = b["refs"][k]
    write({"id": f"edu-fhm-{slug}", "kind": "education", "route": "mixed", "eduType": "FH-MSc",
           "name": {"en": f"{title} – Master (FH)", "de": f"Master {title} (FH)", "fr": None, "it": None},
           "codes": dict(b["codes"]), "sector": b["sector"], "refs": refs,
           "pathway": [EFZ_BM, stage(f"Bachelor (FH)", fh_bachelor_years(slug), f"studienrichtungen/{slug}"),
                       stage(f"Master {title} (FH)", my, f"studienrichtungen/{slug}")],
           "leadsTo": [target], "trainedVia": [], "languageRegions": b["languageRegions"],
           "raw": {"entryAccess": rubric(1, "rubric 0–3", "6-entry-competition", "Admission with a relevant bachelor; some programmes select by dossier/interview.", BB + f"studienrichtungen/{slug}")},
           "meta": {"addedBy": "generated-expansion-2", "reviewed": TODAY,
                    "notes": "Outcomes other than pay are inherited from the bachelor's target occupation. No completion statistic for FH master programmes (missing)."}})
    n_fhm += 1

# ------------------------------------------------------------- 3b) doctorates
dur = dam["studyDuration"]["byField"]
uni_teacher = occupation("23100", "University / higher-education teacher or researcher", "Hochschullehrer/in, Forscher/in",
                         note="Official CH-ISCO-19 occupation type 23100. Target occupation of doctorates (estimate: many doctorate holders work outside academia).")
DR = [("G", "Geistes- und Sozialwissenschaften", "Humanities and social sciences", "uh-geschichte"),
      ("W", "Wirtschaftswissenschaften", "Economics and business", "uh-economics"),
      ("R", "Recht", "Law", "uh-mlaw"),
      ("N", "Exakte und Naturwissenschaften", "Natural sciences and mathematics", "uh-biologie"),
      ("T", "Technische Wissenschaften", "Engineering and technology", "eth-elektrotechnik")]
n_dr = 0
for k, field, en_field, master in DR:
    d = dur.get(field, {}).get("doctorate")
    m = ents.get("edu-" + master)
    if not d or not m: continue
    via = f"edu-dr-{field.split()[0].lower().replace('ä','ae')}"
    write({"id": via, "kind": "education", "route": "academic", "eduType": "DR",
           "name": {"en": f"Doctorate (PhD) – {en_field}", "de": f"Doktorat – {field}", "fr": None, "it": None},
           "codes": {"isco08": "2310"}, "sector": "Research / higher education",
           "refs": {"qualLevel": "higherEducation", "gradIncome": f"uh:Doktorat:{field}", "studyField": f"UH:{field}" if False else None,
                    "besta": "85", "nogaSection": "P"},
           "pathway": [p for p in m["pathway"]] + [stage(f"Doctorate ({field})", d, BFS_DUR,
                        "Mean observed duration (BFS, entry cohorts up to 2016) — doctorates have no fixed standard length.")],
           "leadsTo": [uni_teacher], "trainedVia": [], "languageRegions": ["de", "fr"],
           "raw": {"entryAccess": rubric(2, "rubric 0–3", "6-entry-competition", "Requires a master's degree and a funded doctoral position or supervisor (competitive).")},
           "meta": {"addedBy": "generated-expansion-2", "reviewed": TODAY,
                    "notes": "Pay from the BFS graduate survey for doctorates in this field (1 and 5 years after). Other outcomes are inherited from 'university teacher/researcher' (estimate). No completion statistic for doctorates (missing)."}})
    ents[via]["refs"] = {k2: v for k2, v in ents[via]["refs"].items() if v is not None}
    write(ents[via])
    occupation("23100", via=via)
    n_dr += 1

# ------------------------------------------------------------- 4) all remaining CH-ISCO-19 occupation types
LINK = {"22120": ["edu-uh-medizin"], "26110": ["edu-uh-mlaw"], "26120": ["edu-uh-mlaw"], "26191": ["edu-uh-mlaw"],
        "26420": ["edu-uh-kommunikation-medien", "edu-fh-kommunikation-medien"], "23420": ["edu-ph-primar"], "23540": ["edu-fh-musik"],
        "25101": ["edu-eth-informatik"], "25123": ["edu-fh-informatik"], "25140": ["edu-efz-informatiker"], "25210": ["edu-fh-informatik"],
        "25230": ["edu-efz-informatiker"], "22211": ["edu-hf-pflege"], "21530": ["edu-eth-elektrotechnik"], "21650": ["edu-fh-raumplanung-geomatik"],
        "24110": ["edu-bp-finanz-rechnungswesen"], "24120": ["edu-fh-betriebsoekonomie"], "24130": ["edu-uh-economics"],
        "23530": ["edu-uh-englische-sprach-und-literaturwissenschaft"], "13420": ["edu-hf-pflege"], "12110": ["edu-uh-betriebswirtschaft"],
        "21120": ["edu-uh-physik"], "26560": ["edu-fh-kommunikation-medien"], "31111": ["edu-efz-laborant"]}
SKIP_WORDS = ("Häuptling", "häuptling", "gesetzgebender", "Zofen", "Wasserträger", "Zugtierantrieb", "Handwagen", "Erdöl", "Bergbau", "Aquakultur", "Fischerei", "Hochseefischer", "Subsistenz", "Astrologen", "Tiefbohrer")
n_occ = 0
have = {o["codes"].get("chIsco19") for o in ents.values() if o["kind"] == "occupation"}
for code in sorted(CLS):
    if len(code) != 5 or code[0] == "0" or code[1] == "0" or code.endswith("00") or code in have: continue
    de = CLS[code]["de"]
    if "onA" in de or "anderweitig nicht genannt" in de or any(w in de for w in SKIP_WORDS): continue
    vias = [v for v in LINK.get(code, []) if v in ents]
    oid = occupation(code, via=vias[0] if vias else None,
                     note=("Official CH-ISCO-19 occupation type " + code + ". " +
                           ("" if vias else "No single standard training path (usually reached via experience or various qualifications): training dimensions are missing. ") +
                           "Sector for demand/telework/hours assigned from the occupation group (estimate)."))
    for v in vias[1:]: occupation(code, via=v)
    n_occ += 1

print({"gradField": n_field, "fh_masters": n_fhm, "doctorates": n_dr, "new_occupations": n_occ, "total": len(ents)})
