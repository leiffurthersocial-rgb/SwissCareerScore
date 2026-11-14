"""
Catalogue of Swiss higher-education study programmes open after the Matura, with the institutions
offering them and the project's own outcome estimates. Writes data/inputs/higher-ed-programmes.json.

Estimates (expert judgment, 2026; see docs/methodology.md §15):
  pay1   gross CHF/month (annual incl. 13th ÷ 12), full-time, ~1 year after the usual exit degree,
         all employed graduates incl. those starting a doctorate (same definition as BFS EHA)
  pay5   same, ~5 years after the degree
  unemp  ILO unemployment rate 1 year after the degree, %
  drop   % of entrants who leave higher education without a bachelor's degree
  years  standard years after the Matura to the usual professional exit degree
Institution lists: compiled 2026 from swissuniversities' studyprogrammes.ch and the universities'
own pages. Small programmes change often: check studyprogrammes.ch before deciding.
Run: python3 scripts/authoring/programmes.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

# code: (name, short, type, city, languages, url)
INST = {
    "ETHZ": ("ETH Zürich", "ETH", "ETH", "Zürich", ["de", "en"], "https://ethz.ch"),
    "EPFL": ("EPFL – École polytechnique fédérale de Lausanne", "EPFL", "ETH", "Lausanne", ["fr", "en"], "https://www.epfl.ch"),
    "UZH": ("Universität Zürich", "UZH", "UH", "Zürich", ["de"], "https://www.uzh.ch"),
    "UNIBE": ("Universität Bern", "Bern", "UH", "Bern", ["de"], "https://www.unibe.ch"),
    "UNIBAS": ("Universität Basel", "Basel", "UH", "Basel", ["de"], "https://www.unibas.ch"),
    "UNIGE": ("Université de Genève", "Genève", "UH", "Genève", ["fr"], "https://www.unige.ch"),
    "UNIL": ("Université de Lausanne", "UNIL", "UH", "Lausanne", ["fr"], "https://www.unil.ch"),
    "UNIFR": ("Universität Freiburg / Université de Fribourg", "Fribourg", "UH", "Fribourg", ["de", "fr"], "https://www.unifr.ch"),
    "UNINE": ("Université de Neuchâtel", "Neuchâtel", "UH", "Neuchâtel", ["fr"], "https://www.unine.ch"),
    "UNILU": ("Universität Luzern", "Luzern", "UH", "Luzern", ["de"], "https://www.unilu.ch"),
    "UNISG": ("Universität St. Gallen (HSG)", "HSG", "UH", "St. Gallen", ["de", "en"], "https://www.unisg.ch"),
    "USI": ("Università della Svizzera italiana", "USI", "UH", "Lugano / Mendrisio", ["it", "en"], "https://www.usi.ch"),
    "UNIDIST": ("UniDistance Suisse (distance learning)", "UniDistance", "UH", "Brig", ["de", "fr"], "https://unidistance.ch"),
    "ZHAW": ("ZHAW Zürcher Hochschule für Angewandte Wissenschaften", "ZHAW", "FH", "Winterthur / Zürich / Wädenswil", ["de"], "https://www.zhaw.ch"),
    "FHNW": ("FHNW Fachhochschule Nordwestschweiz", "FHNW", "FH", "Windisch / Basel / Olten / Muttenz", ["de"], "https://www.fhnw.ch"),
    "BFH": ("BFH Berner Fachhochschule", "BFH", "FH", "Bern / Biel / Burgdorf / Zollikofen", ["de", "fr"], "https://www.bfh.ch"),
    "HSLU": ("HSLU Hochschule Luzern", "HSLU", "FH", "Luzern / Zug", ["de"], "https://www.hslu.ch"),
    "OST": ("OST Ostschweizer Fachhochschule", "OST", "FH", "Rapperswil / St. Gallen / Buchs", ["de"], "https://www.ost.ch"),
    "FHGR": ("FHGR Fachhochschule Graubünden", "FHGR", "FH", "Chur", ["de"], "https://www.fhgr.ch"),
    "HESSO": ("HES-SO Haute école spécialisée de Suisse occidentale (incl. EHL, ECAL, HEAD, HEIG-VD)", "HES-SO", "FH", "Western Switzerland", ["fr", "de"], "https://www.hes-so.ch"),
    "SUPSI": ("SUPSI Scuola universitaria professionale della Svizzera italiana", "SUPSI", "FH", "Ticino", ["it"], "https://www.supsi.ch"),
    "KALAIDOS": ("Kalaidos Fachhochschule (private)", "Kalaidos", "FH", "Zürich", ["de"], "https://www.kalaidos-fh.ch"),
    "ZHDK": ("ZHdK Zürcher Hochschule der Künste", "ZHdK", "FH", "Zürich", ["de"], "https://www.zhdk.ch"),
    "HKB": ("HKB Hochschule der Künste Bern (BFH)", "HKB", "FH", "Bern / Biel", ["de", "fr"], "https://www.hkb.bfh.ch"),
    "HFH": ("HfH Interkantonale Hochschule für Heilpädagogik", "HfH", "FH", "Zürich", ["de"], "https://www.hfh.ch"),
    "EHSM": ("EHSM Eidgenössische Hochschule für Sport Magglingen", "EHSM", "FH", "Magglingen", ["de", "fr"], "https://www.ehsm.admin.ch"),
    "PHZH": ("PH Zürich", "PHZH", "PH", "Zürich", ["de"], "https://phzh.ch"),
    "PHBERN": ("PH Bern", "PHBern", "PH", "Bern", ["de"], "https://www.phbern.ch"),
    "PHLU": ("PH Luzern", "PHLU", "PH", "Luzern", ["de"], "https://www.phlu.ch"),
    "PHSG": ("PH St. Gallen", "PHSG", "PH", "St. Gallen / Rorschach", ["de"], "https://www.phsg.ch"),
    "PHFHNW": ("PH FHNW", "PH FHNW", "PH", "Windisch / Muttenz / Solothurn", ["de"], "https://www.fhnw.ch/de/die-fhnw/hochschulen/ph"),
    "PHTG": ("PH Thurgau", "PHTG", "PH", "Kreuzlingen", ["de"], "https://www.phtg.ch"),
    "PHGR": ("PH Graubünden", "PHGR", "PH", "Chur", ["de", "it", "rm"], "https://phgr.ch"),
    "PHZG": ("PH Zug", "PHZG", "PH", "Zug", ["de"], "https://www.phzg.ch"),
    "PHSZ": ("PH Schwyz", "PHSZ", "PH", "Goldau", ["de"], "https://www.phsz.ch"),
    "PHSH": ("PH Schaffhausen", "PHSH", "PH", "Schaffhausen", ["de"], "https://www.phsh.ch"),
    "HEPVD": ("HEP Vaud", "HEP Vaud", "PH", "Lausanne", ["fr"], "https://www.hepl.ch"),
    "HEPBEJUNE": ("HEP-BEJUNE", "HEP-BEJUNE", "PH", "Bienne / Delémont / La Chaux-de-Fonds", ["fr"], "https://www.hep-bejune.ch"),
    "HEPFR": ("HEP | PH Fribourg", "HEP FR", "PH", "Fribourg", ["fr", "de"], "https://www.hepfr.ch"),
    "HEPVS": ("HEP-VS / PH Wallis", "PH VS", "PH", "St-Maurice / Brig", ["fr", "de"], "https://hepvs.ch"),
}

UH8 = ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE", "UNILU"]
UH7 = ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE"]
ALL_PH = ["PHZH", "PHBERN", "PHLU", "PHSG", "PHFHNW", "PHTG", "PHGR", "PHZG", "PHSZ", "PHSH", "HEPVD", "HEPBEJUNE", "HEPFR", "HEPVS", "SUPSI", "UNIGE"]
FH_BIZ = ["ZHAW", "FHNW", "BFH", "HSLU", "OST", "FHGR", "HESSO", "SUPSI", "KALAIDOS"]
FH_ENG = ["ZHAW", "FHNW", "BFH", "HSLU", "OST", "HESSO", "SUPSI"]
ARTS = ["ZHDK", "HKB", "FHNW", "HSLU", "HESSO", "SUPSI"]

# Admission: open = Matura suffices; ems = numerus clausus aptitude test (EMS) or selection after
# year 1; selection = aptitude test / portfolio / selection procedure; work = FH: one year of
# relevant work experience (or additional modules) required for holders of a gymnasial Matura.
# (group, id, entity, en, de, type, unis, admission, years, pay1, pay5, unemp, drop, masterOnly, note)
P = [
    # ---------------------------------------------------------------- medicine & health
    ("medicine", "humanmedizin", "edu-uh-medizin", "Human medicine", "Humanmedizin", "UH", ["ETHZ", "UZH", "UNIBE", "UNIBAS", "UNIFR", "UNIGE", "UNIL", "USI", "UNILU", "UNISG"], "ems", 6, 8200, 9800, 0.5, 6, False,
     "German-speaking universities select with the EMS aptitude test (~1 in 3 admitted); Geneva and Lausanne select after year 1. USI, Lucerne and St. Gallen offer the master (bachelor at a partner). Specialist training (FMH) takes another 5–6 years."),
    ("medicine", "zahnmedizin", "edu-uh-zahnmedizin", "Dental medicine", "Zahnmedizin", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE"], "ems", 5, 7000, 10500, 1.5, 6, False, "EMS numerus clausus (Geneva: selection after year 1)."),
    ("medicine", "veterinaermedizin", "edu-uh-veterinaermedizin", "Veterinary medicine", "Veterinärmedizin", "UH", ["UZH", "UNIBE"], "ems", 5, 5600, 7300, 1.5, 7, False, "Vetsuisse faculty; EMS numerus clausus. Starting salaries are low relative to study length."),
    ("medicine", "chiropraktik", "edu-uh-chiropraktik", "Chiropractic medicine", "Chiropraktik", "UH", ["UZH"], "ems", 6, 6500, 10000, 1.0, 6, False, "Bachelor shared with human medicine (EMS); then 2 years of assistantship."),
    ("medicine", "pharmazie", "edu-uh-pharmazie", "Pharmacy", "Pharmazie", "UH", ["ETHZ", "UNIBAS", "UNIBE", "UNIGE"], "open", 5, 8000, 9300, 1.5, 20, False, "Federal pharmacist diploma after the master. Demanding first year (chemistry)."),
    ("medicine", "biomedizin", "edu-uh-biomedizinische-wissenschaften", "Biomedical sciences", "Biomedizinische Wissenschaften", "UH", ["UZH", "UNIBE", "UNIFR", "UNIBAS"], "open", 5, 5000, 7800, 4.0, 18, False, "Research-oriented; a doctorate is common, which lowers early pay."),
    ("medicine", "gesundheitswissenschaften", "edu-uh-gesundheitswissenschaften", "Health sciences and technology", "Gesundheitswissenschaften und Technologie", "UH", ["ETHZ", "UNILU"], "open", 5, 5700, 8300, 4.0, 15, False, "ETH: Health Sciences and Technology (HST); Lucerne: Health Sciences."),
    ("medicine", "sport-uh", "edu-uh-sport-sportwissenschaften", "Sport and exercise science", "Sportwissenschaften", "UH", ["ETHZ", "UNIBE", "UNIBAS", "UNIFR", "UNIGE", "UNIL"], "selection", 5, 5800, 8000, 3.0, 12, False, "Sports aptitude test. Many graduates teach sport with an additional teaching diploma."),
    ("medicine", "pflegewissenschaft", "edu-uh-pflege-pflegewissenschaft", "Nursing science (master)", "Pflegewissenschaft (Master)", "UH", ["UNIBAS", "UNIL"], "open", 5, 8000, 9200, 1.0, 8, True, "Master only — entry after a nursing bachelor (FH)."),
    ("health", "pflege", "edu-fh-pflege", "Nursing", "Pflege", "FH", ["ZHAW", "BFH", "OST", "KALAIDOS", "HESSO", "SUPSI"], "work", 3, 6500, 7500, 0.8, 12, False, "Gymnasium graduates need additional practical modules first. Very high demand."),
    ("health", "physiotherapie", "edu-fh-physio", "Physiotherapy", "Physiotherapie", "FH", ["ZHAW", "BFH", "HESSO", "SUPSI"], "selection", 4, 6300, 7400, 1.0, 8, False, "Aptitude/selection procedure; German-speaking schools add a 10-month clinical module."),
    ("health", "ergotherapie", "edu-fh-ergotherapie", "Occupational therapy", "Ergotherapie", "FH", ["ZHAW", "HESSO", "SUPSI"], "work", 3, 6100, 7000, 1.0, 8, False, None),
    ("health", "hebamme", "edu-fh-hebamme", "Midwifery", "Hebamme", "FH", ["ZHAW", "BFH", "HESSO"], "selection", 4, 6500, 7400, 0.8, 8, False, "Selection procedure; German-speaking schools add a clinical module."),
    ("health", "ernaehrung", "edu-fh-ernaehrung-und-diaetetik", "Nutrition and dietetics", "Ernährung und Diätetik", "FH", ["BFH", "HESSO"], "work", 3, 6000, 6900, 3.0, 10, False, None),
    ("health", "radiologie", "edu-fh-medizinisch-technische-radiologie", "Medical radiology technology", "Medizinisch-technische Radiologie", "FH", ["HESSO"], "work", 3, 6400, 7300, 1.0, 10, False, "German-speaking Switzerland trains MTR at HF level instead."),
    ("health", "osteopathie", "edu-fh-osteopathie", "Osteopathy", "Osteopathie", "FH", ["HESSO"], "selection", 5, 6000, 8500, 2.0, 10, False, "Bachelor + master required for practice; often self-employed."),
    ("health", "optometrie", "edu-fh-optometrie", "Optometry", "Optometrie", "FH", ["FHNW"], "work", 3, 6300, 7500, 1.5, 12, False, None),
    ("health", "logopaedie", "edu-fh-logopaedie", "Speech and language therapy", "Logopädie", "FH", ["HFH", "FHNW", "UNIFR", "UNINE", "UNIGE"], "selection", 3, 6700, 8000, 1.0, 8, False, "Paid on teacher scales in most cantons; Romandie trains at university level (master)."),
    ("health", "psychomotorik", "edu-fh-psychomotoriktherapie", "Psychomotor therapy", "Psychomotoriktherapie", "FH", ["HFH", "HESSO"], "selection", 3, 6700, 8000, 1.5, 8, False, None),
    ("health", "sport-fh", "edu-fh-sport-sportwissenschaften", "Sport (applied)", "Sport (FH)", "FH", ["EHSM"], "selection", 3, 5500, 6800, 3.0, 10, False, "Sports aptitude test; small cohorts."),
    # ---------------------------------------------------------------- natural sciences & mathematics
    ("science", "mathematik", "edu-uh-mathematik", "Mathematics", "Mathematik", "UH", ["ETHZ", "EPFL", "UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIFR", "UNINE"], "open", 4.5, 6000, 9500, 3.5, 30, False, "Very demanding first year; graduates are sought in finance, insurance, IT and data."),
    ("science", "physik", "edu-uh-physik", "Physics", "Physik", "UH", ["ETHZ", "EPFL", "UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIFR"], "open", 5, 5300, 9000, 3.5, 30, False, "Most graduates start a doctorate (low pay at first), later strong pay in industry/finance."),
    ("science", "chemie", "edu-uh-chemie", "Chemistry", "Chemie", "UH", ["ETHZ", "EPFL", "UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIFR"], "open", 4.5, 5000, 8800, 3.5, 25, False, "A doctorate is the norm for chemists in industry."),
    ("science", "biochemie", "edu-uh-biochemie", "Biochemistry", "Biochemie", "UH", ["UZH", "UNIBE", "UNIGE", "UNIFR", "ETHZ"], "open", 5, 4900, 8000, 4.0, 22, False, "ETH: Chemistry and biochemistry track; doctorate common."),
    ("science", "biologie", "edu-uh-biologie", "Biology", "Biologie", "UH", ["ETHZ", "UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE"], "open", 5, 4800, 7600, 5.5, 22, False, "Large cohorts; many doctorates and fixed-term research jobs."),
    ("science", "erdwissenschaften", "edu-uh-erdwissenschaften", "Earth sciences", "Erdwissenschaften", "UH", ["ETHZ", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR"], "open", 5, 5400, 8000, 4.5, 20, False, None),
    ("science", "geographie", "edu-uh-geographie", "Geography", "Geographie", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE"], "open", 4.5, 5800, 8000, 4.5, 18, False, "Many become teachers or work in planning, environment and GIS."),
    ("science", "umweltwissenschaften", "edu-eth-umweltwissenschaften-waldwissenschaften", "Environmental sciences", "Umweltnaturwissenschaften", "ETH", ["ETHZ", "UNIL", "UNIGE", "UNIBAS"], "open", 4.5, 5600, 8000, 4.5, 18, False, None),
    ("science", "agrar-eth", "edu-eth-agrarwissenschaften", "Agricultural sciences", "Agrarwissenschaften", "ETH", ["ETHZ"], "open", 5, 6000, 8200, 3.0, 18, False, None),
    ("science", "lebensmittel-eth", "edu-eth-lebensmittelwissenschaften", "Food science", "Lebensmittelwissenschaften", "ETH", ["ETHZ"], "open", 4.5, 6300, 8600, 3.0, 20, False, None),
    ("science", "forensik", "edu-uh-forensische-wissenschaften", "Forensic science", "Forensische Wissenschaften", "UH", ["UNIL"], "open", 5, 5800, 8300, 4.0, 20, False, "École des sciences criminelles, Lausanne (French)."),
    # ---------------------------------------------------------------- computing
    ("computing", "informatik-eth", "edu-eth-informatik", "Computer science (ETH/EPFL)", "Informatik (ETH/EPFL)", "ETH", ["ETHZ", "EPFL"], "open", 4.5, 8500, 11000, 2.5, 35, False, "First-year exam (Basisprüfung) eliminates a large share; top starting pay in Switzerland."),
    ("computing", "informatik-uh", "edu-uh-informatik", "Computer science (university)", "Informatik (Universität)", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIFR", "UNINE", "USI", "UNISG", "UNIDIST"], "open", 4.5, 7300, 9800, 3.0, 30, False, None),
    ("computing", "cse", "edu-eth-rechnergestuetzte-wissenschaften", "Computational science and engineering", "Rechnergestützte Wissenschaften", "ETH", ["ETHZ"], "open", 4.5, 7800, 10500, 2.5, 30, False, None),
    ("computing", "wirtschaftsinformatik-uh", "edu-uh-wirtschaftsinformatik", "Business information systems (university)", "Wirtschaftsinformatik (Universität)", "UH", ["UZH", "UNIBE", "UNIFR", "UNIGE", "UNIL", "UNISG"], "open", 4.5, 7500, 9800, 2.5, 20, False, None),
    ("computing", "computerlinguistik", "edu-uh-computerlinguistik", "Computational linguistics", "Computerlinguistik", "UH", ["UZH", "UNIGE"], "open", 5, 6800, 9000, 3.5, 20, False, None),
    ("computing", "informatik-fh", "edu-fh-informatik", "Computer science (applied)", "Informatik (FH)", "FH", ["ZHAW", "FHNW", "BFH", "HSLU", "OST", "FHGR", "HESSO", "SUPSI"], "work", 3, 7000, 9000, 2.5, 20, False, "Gymnasium graduates need one year of IT work experience (several schools offer integrated practice models)."),
    ("computing", "wirtschaftsinformatik-fh", "edu-fh-wirtschaftsinformatik", "Business information systems (applied)", "Wirtschaftsinformatik (FH)", "FH", FH_BIZ, "work", 3, 7200, 9300, 2.0, 15, False, None),
    # ---------------------------------------------------------------- engineering & architecture
    ("engineering", "elektrotechnik-eth", "edu-eth-elektrotechnik", "Electrical engineering (ETH/EPFL)", "Elektrotechnik (ETH/EPFL)", "ETH", ["ETHZ", "EPFL"], "open", 4.5, 7800, 10200, 2.5, 30, False, None),
    ("engineering", "maschinenbau-eth", "edu-eth-maschineningenieurwissenschaften", "Mechanical engineering (ETH/EPFL)", "Maschineningenieurwissenschaften (ETH/EPFL)", "ETH", ["ETHZ", "EPFL"], "open", 4.5, 7600, 10000, 2.5, 30, False, None),
    ("engineering", "bauingenieur-eth", "edu-eth-bauingenieur", "Civil engineering (ETH/EPFL)", "Bauingenieurwissenschaften (ETH/EPFL)", "ETH", ["ETHZ", "EPFL"], "open", 4.5, 7000, 9200, 1.5, 25, False, "Strong shortage of civil engineers."),
    ("engineering", "architektur-eth", "edu-eth-architektur", "Architecture (ETH/EPFL/USI)", "Architektur (ETH/EPFL/USI)", "ETH", ["ETHZ", "EPFL", "USI"], "open", 6, 5700, 7500, 3.5, 18, False, "Includes a one-year practical internship; architect salaries are modest for the study length."),
    ("engineering", "materialwissenschaft", "edu-eth-materialwissenschaft", "Materials science", "Materialwissenschaft", "ETH", ["ETHZ", "EPFL"], "open", 4.5, 7000, 9500, 3.0, 28, False, None),
    ("engineering", "mikrotechnik", "edu-eth-mikrotechnik", "Microengineering", "Mikrotechnik", "ETH", ["EPFL"], "open", 5, 7500, 9800, 3.0, 30, False, "EPFL (French/English)."),
    ("engineering", "geomatik-eth", "edu-eth-raumplanung-geomatik", "Geomatics and spatial engineering", "Raumbezogene Ingenieurwissenschaften", "ETH", ["ETHZ"], "open", 4.5, 6800, 8800, 2.0, 22, False, None),
    ("engineering", "umweltingenieur-eth", "edu-eth-umweltingenieurwissenschaften", "Environmental engineering (ETH/EPFL)", "Umweltingenieurwissenschaften (ETH/EPFL)", "ETH", ["ETHZ", "EPFL"], "open", 4.5, 6800, 8900, 2.5, 22, False, None),
    ("engineering", "elektrotechnik-fh", "edu-fh-elektrotechnik-informationstechnologie", "Electrical engineering (applied)", "Elektrotechnik (FH)", "FH", FH_ENG, "work", 3, 7000, 8900, 2.0, 20, False, None),
    ("engineering", "maschinentechnik-fh", "edu-fh-maschinentechnik", "Mechanical engineering (applied)", "Maschinentechnik (FH)", "FH", FH_ENG, "work", 3, 6900, 8800, 2.0, 18, False, None),
    ("engineering", "mechatronik-fh", "edu-fh-mechatronik", "Mechatronics", "Mechatronik", "FH", ["FHNW", "FHGR", "BFH"], "work", 3, 6900, 8800, 2.0, 18, False, None),
    ("engineering", "systemtechnik-fh", "edu-fh-systemtechnik", "Systems engineering", "Systemtechnik", "FH", ["ZHAW", "OST", "FHNW", "HESSO"], "work", 3, 6900, 8800, 2.0, 18, False, None),
    ("engineering", "medizintechnik-fh", "edu-fh-medizintechnik", "Medical engineering", "Medizintechnik", "FH", ["BFH", "HSLU"], "work", 3, 6700, 8500, 3.0, 18, False, None),
    ("engineering", "wirtschaftsing-fh", "edu-fh-wirtschaftsingenieurwesen", "Industrial engineering and management", "Wirtschaftsingenieurwesen", "FH", FH_ENG, "work", 3, 7200, 9200, 2.0, 15, False, None),
    ("engineering", "aviatik", "edu-fh-aviatik", "Aviation", "Aviatik", "FH", ["ZHAW"], "work", 3, 6800, 9000, 3.0, 18, False, None),
    ("engineering", "architektur-fh", "edu-fh-architektur", "Architecture (applied)", "Architektur (FH)", "FH", ["ZHAW", "FHNW", "BFH", "HSLU", "OST", "FHGR", "HESSO", "SUPSI"], "work", 3, 5900, 7600, 3.0, 15, False, None),
    ("engineering", "bauingenieur-fh", "edu-fh-bauingenieurwissenschaften", "Civil engineering (applied)", "Bauingenieurwesen (FH)", "FH", ["ZHAW", "FHNW", "BFH", "HSLU", "OST", "FHGR", "HESSO", "SUPSI"], "work", 3, 6900, 8700, 1.2, 15, False, None),
    ("engineering", "gebaeudetechnik", "edu-fh-gebaeudetechnik", "Building services engineering", "Gebäudetechnik", "FH", ["HSLU", "FHNW", "HESSO"], "work", 3, 7000, 8800, 1.0, 15, False, "Severe shortage; energy transition demand."),
    ("engineering", "holztechnik", "edu-fh-holztechnik", "Wood engineering", "Holztechnik", "FH", ["BFH"], "work", 3, 6600, 8300, 1.5, 12, False, None),
    ("engineering", "landschaftsarchitektur", "edu-fh-landschaftsarchitektur", "Landscape architecture", "Landschaftsarchitektur", "FH", ["OST", "HESSO"], "work", 3, 5800, 7300, 3.0, 12, False, None),
    ("engineering", "geomatik-fh", "edu-fh-raumplanung-geomatik", "Spatial planning and geomatics (applied)", "Raumplanung, Geomatik (FH)", "FH", ["OST", "FHNW", "HESSO"], "work", 3, 6500, 8200, 2.0, 15, False, None),
    ("engineering", "biotech-fh", "edu-fh-biotechnologie", "Biotechnology", "Biotechnologie", "FH", ["ZHAW", "HESSO", "FHNW"], "work", 3, 5900, 7600, 4.5, 15, False, None),
    ("engineering", "chemie-fh", "edu-fh-chemie", "Chemistry (applied)", "Chemie (FH)", "FH", ["ZHAW", "FHNW", "HESSO"], "work", 3, 6100, 7800, 4.0, 15, False, None),
    ("engineering", "lebensmittel-fh", "edu-fh-lebensmittelwissenschaften", "Food technology", "Lebensmitteltechnologie", "FH", ["BFH", "ZHAW"], "work", 3, 6000, 7600, 3.0, 12, False, None),
    ("engineering", "umweltingenieur-fh", "edu-fh-umweltingenieurwissenschaften", "Environmental engineering (applied)", "Umweltingenieurwesen (FH)", "FH", ["ZHAW", "OST", "HESSO"], "work", 3, 5900, 7500, 3.5, 12, False, None),
    ("engineering", "wald-fh", "edu-fh-umweltwissenschaften-waldwissenschaften", "Forest sciences", "Waldwissenschaften", "FH", ["BFH"], "work", 3, 5900, 7500, 3.0, 12, False, None),
    ("engineering", "agrar-fh", "edu-fh-agrarwissenschaften", "Agriculture (applied)", "Agronomie (FH)", "FH", ["BFH", "HESSO"], "work", 3, 5900, 7500, 2.0, 12, False, None),
    # ---------------------------------------------------------------- business, economics, law
    ("business", "bwl-uh", "edu-uh-betriebswirtschaft", "Business administration (university)", "Betriebswirtschaft (Universität)", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE", "UNILU", "UNISG", "USI"], "open", 4.5, 7000, 10000, 3.5, 20, False, "Includes banking & finance and accounting specialisations (UZH, HSG …)."),
    ("business", "vwl-uh", "edu-uh-economics", "Economics", "Volkswirtschaftslehre", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE", "UNILU", "UNISG", "USI"], "open", 4.5, 7200, 10500, 3.5, 25, False, None),
    ("business", "recht", "edu-uh-mlaw", "Law", "Rechtswissenschaft", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE", "UNILU", "UNISG"], "open", 6, 5600, 10000, 3.0, 20, False, "Master plus 1–2 years of traineeship for the bar exam; low trainee pay, then steep growth."),
    ("business", "internationale-studien", "edu-uh-internationale-studien", "International relations", "Internationale Beziehungen", "UH", ["UNIGE", "UNISG"], "open", 5, 6000, 8500, 5.0, 18, False, None),
    ("business", "bwl-fh", "edu-fh-betriebsoekonomie", "Business administration (applied)", "Betriebsökonomie (FH)", "FH", FH_BIZ, "work", 3, 6700, 8800, 3.0, 15, False, "Most popular FH programme; part-time study possible."),
    ("business", "tourismus", "edu-fh-tourismus", "Tourism", "Tourismus", "FH", ["HSLU", "FHGR", "HESSO"], "work", 3, 5500, 7000, 4.0, 12, False, None),
    ("business", "hospitality", "edu-fh-hospitality-management", "Hospitality management", "Hospitality Management", "FH", ["HESSO"], "selection", 4, 6000, 8500, 3.0, 10, False, "EHL Lausanne; high tuition fees for this school (unlike public universities)."),
    ("business", "facility", "edu-fh-facility-management", "Facility management", "Facility Management", "FH", ["ZHAW"], "work", 3, 6300, 8000, 2.5, 12, False, None),
    ("business", "informationswissenschaft", "edu-fh-informationswissenschaft", "Information science", "Informationswissenschaft", "FH", ["FHGR", "HESSO"], "work", 3, 6000, 7500, 3.5, 15, False, None),
    # ---------------------------------------------------------------- social sciences
    ("social", "psychologie-uh", "edu-uh-psychologie", "Psychology (university)", "Psychologie (Universität)", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNINE", "UNIDIST"], "open", 5, 5800, 8000, 4.5, 20, False, "Psychotherapist licence needs another 4–5 years of paid-but-low-wage training."),
    ("social", "psychologie-fh", "edu-fh-psychologie", "Applied psychology", "Angewandte Psychologie (FH)", "FH", ["ZHAW", "FHNW", "KALAIDOS"], "work", 4.5, 6300, 8000, 4.0, 12, False, "The protected title 'psychologist' requires the master."),
    ("social", "soziale-arbeit", "edu-fh-soziale-arbeit", "Social work", "Soziale Arbeit", "FH", FH_ENG, "work", 3, 6500, 7600, 1.5, 12, False, "Part-time, work-integrated study common."),
    ("social", "soziologie", "edu-uh-soziologie", "Sociology", "Soziologie", "UH", UH8, "open", 5, 5800, 7900, 5.5, 25, False, None),
    ("social", "politikwissenschaft", "edu-uh-politikwissenschaft", "Political science", "Politikwissenschaft", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNILU", "UNISG"], "open", 5, 6000, 8300, 5.0, 22, False, None),
    ("social", "kommunikation-uh", "edu-uh-kommunikation-medien", "Communication and media (university)", "Kommunikations- und Medienwissenschaft", "UH", ["UZH", "UNIFR", "USI", "UNINE", "UNIBE"], "open", 4.5, 5800, 7800, 5.0, 18, False, None),
    ("social", "kommunikation-fh", "edu-fh-kommunikation-medien", "Communication and journalism (applied)", "Kommunikation, Journalismus (FH)", "FH", ["ZHAW", "FHGR", "HSLU"], "work", 3, 5600, 7200, 4.5, 12, False, None),
    ("social", "erziehungswissenschaft", "edu-uh-erziehungswissenschaft", "Educational science", "Erziehungswissenschaft", "UH", ["UZH", "UNIBE", "UNIGE", "UNIFR"], "open", 5, 6200, 8300, 3.5, 20, False, None),
    ("social", "ethnologie", "edu-uh-sozialanthropologie-kulturanthropologie", "Social and cultural anthropology", "Sozial- und Kulturanthropologie", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIL", "UNIFR", "UNINE", "UNILU"], "open", 5, 5500, 7500, 6.0, 25, False, None),
    ("social", "gender", "edu-uh-gender-studies", "Gender studies (master)", "Gender Studies (Master)", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL"], "open", 5, 5300, 7300, 6.5, 15, True, "Mostly a master or minor subject."),
    ("social", "osteuropa", "edu-uh-osteuropa-studien", "Eastern European studies (master)", "Osteuropa-Studien (Master)", "UH", ["UNIBAS", "UNIBE"], "open", 5, 5300, 7400, 6.0, 20, True, None),
    # ---------------------------------------------------------------- humanities & languages
    ("humanities", "geschichte", "edu-uh-geschichte", "History", "Geschichte", "UH", UH8, "open", 5, 5800, 7900, 5.5, 25, False, "Many graduates add a teaching diploma for upper secondary schools."),
    ("humanities", "philosophie", "edu-uh-philosophie", "Philosophy", "Philosophie", "UH", UH8, "open", 5, 5400, 7600, 6.0, 30, False, None),
    ("humanities", "kunstgeschichte", "edu-uh-kunstgeschichte", "Art history", "Kunstgeschichte", "UH", UH7, "open", 5, 5000, 6900, 6.5, 25, False, None),
    ("humanities", "archaeologie", "edu-uh-archaeologie-aegyptologie", "Archaeology", "Archäologie", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNINE"], "open", 5, 4800, 6600, 7.0, 25, False, None),
    ("humanities", "germanistik", "edu-uh-deutsche-sprach-und-literaturwissenschaft", "German language and literature", "Germanistik", "UH", UH7, "open", 5, 5900, 8000, 4.5, 22, False, None),
    ("humanities", "anglistik", "edu-uh-englische-sprach-und-literaturwissenschaft", "English language and literature", "Anglistik", "UH", UH7, "open", 5, 5800, 7900, 5.0, 22, False, None),
    ("humanities", "franzoesisch", "edu-uh-franzoesische-sprach-und-literaturwissenschaft", "French language and literature", "Französistik", "UH", UH7, "open", 5, 5900, 8000, 4.5, 22, False, None),
    ("humanities", "italienisch", "edu-uh-italienische-sprach-und-literaturwissenschaft", "Italian language and literature", "Italianistik", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "USI"], "open", 5, 5900, 8000, 4.5, 22, False, None),
    ("humanities", "spanisch", "edu-uh-spanische-sprach-und-literaturwissenschaft", "Spanish language and literature", "Hispanistik", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNINE"], "open", 5, 5500, 7500, 6.0, 25, False, None),
    ("humanities", "raetoromanisch", "edu-uh-raetoromanische-sprach-und-literaturwissenschaft", "Romansh language and literature", "Rätoromanistik", "UH", ["UZH", "UNIFR"], "open", 5, 6000, 8200, 2.5, 20, False, "Tiny cohorts; teachers and media (RTR) are in demand."),
    ("humanities", "latein-griechisch", "edu-uh-latein-griechisch", "Classics (Latin, Greek)", "Latein, Griechisch", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR"], "open", 5, 6200, 8400, 3.0, 25, False, "Shortage of Latin teachers at Gymnasien."),
    ("humanities", "linguistik", "edu-uh-allgemeine-sprachwissenschaft", "Linguistics", "Allgemeine Sprachwissenschaft", "UH", ["UZH", "UNIBE", "UNIGE", "UNIL"], "open", 5, 5500, 7600, 5.5, 22, False, None),
    ("humanities", "vergleichende-literatur", "edu-uh-vergleichende-literaturwissenschaft", "Comparative literature", "Vergleichende Literaturwissenschaft", "UH", ["UZH", "UNIGE", "UNIL"], "open", 5, 5200, 7200, 6.5, 25, False, None),
    ("humanities", "uebersetzen-uh", "edu-uh-uebersetzen-dolmetschen", "Translation and interpreting (university)", "Übersetzen und Dolmetschen (Universität)", "UH", ["UNIGE"], "open", 5, 5800, 7900, 4.5, 20, False, "AI translation puts pressure on routine translation work."),
    ("humanities", "uebersetzen-fh", "edu-fh-uebersetzen-dolmetschen", "Applied languages / translation", "Angewandte Sprachen (FH)", "FH", ["ZHAW"], "work", 3, 5500, 7200, 5.0, 15, False, "AI translation puts pressure on routine translation work."),
    ("humanities", "theologie", "edu-uh-theologie", "Theology", "Theologie", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR", "UNILU"], "open", 5, 6500, 8200, 1.5, 20, False, "Churches report a shortage of pastors; church practical year follows."),
    ("humanities", "religionswissenschaft", "edu-uh-religionswissenschaft", "Religious studies", "Religionswissenschaft", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIL", "UNIFR", "UNILU"], "open", 5, 5200, 7200, 6.0, 25, False, None),
    ("humanities", "musikwissenschaft", "edu-uh-musikwissenschaft", "Musicology", "Musikwissenschaft", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIFR"], "open", 5, 5000, 7000, 6.5, 25, False, None),
    ("humanities", "filmwissenschaft", "edu-uh-filmwissenschaft", "Film studies", "Filmwissenschaft", "UH", ["UZH", "UNIL"], "open", 5, 4900, 6800, 7.5, 25, False, None),
    ("humanities", "theaterwissenschaft", "edu-uh-theaterwissenschaft-tanzwissenschaft", "Theatre and dance studies", "Theater- und Tanzwissenschaft", "UH", ["UNIBE"], "open", 5, 4800, 6600, 7.5, 25, False, None),
    ("humanities", "chinesisch", "edu-uh-chinesische-sprachen-und-kulturen", "Chinese studies", "Sinologie", "UH", ["UZH", "UNIGE"], "open", 5, 5500, 7800, 6.0, 25, False, None),
    ("humanities", "japanisch", "edu-uh-japanische-sprache-und-kulturen", "Japanese studies", "Japanologie", "UH", ["UZH", "UNIGE"], "open", 5, 5400, 7600, 6.0, 25, False, None),
    ("humanities", "indisch", "edu-uh-indische-sprachen-und-kulturen", "South Asian studies", "Südasienstudien", "UH", ["UNIL", "UZH"], "open", 5, 5000, 7000, 7.0, 25, False, None),
    ("humanities", "islamwissenschaft", "edu-uh-islamische-kulturen-arabisch", "Islamic and Middle Eastern studies", "Islamwissenschaft, Arabistik", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE"], "open", 5, 5200, 7400, 6.5, 25, False, None),
    ("humanities", "judaistik", "edu-uh-juedische-kulturen-hebraeisch", "Jewish studies", "Jüdische Studien", "UH", ["UNIBAS", "UNILU", "UNIBE"], "open", 5, 5200, 7300, 6.0, 25, False, None),
    ("humanities", "slavistik", "edu-uh-slavische-sprach-und-literaturwissenschaft", "Slavic studies", "Slavistik", "UH", ["UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIL", "UNIFR"], "open", 5, 5300, 7400, 6.0, 25, False, None),
    ("humanities", "skandinavistik", "edu-uh-nordische-sprach-und-literaturwissenschaft", "Scandinavian studies", "Skandinavistik", "UH", ["UZH", "UNIBAS"], "open", 5, 5300, 7400, 6.0, 25, False, None),
    ("humanities", "neugriechisch", "edu-uh-neugriechische-sprach-und-literaturwissenschaft", "Modern Greek studies", "Neogräzistik", "UH", ["UNIGE", "UZH"], "open", 5, 5200, 7200, 6.5, 25, False, None),
    ("humanities", "armenisch", "edu-uh-armenische-sprach-und-literaturwissenschaft", "Armenian studies", "Armenologie", "UH", ["UNIGE"], "open", 5, 5000, 7000, 7.0, 25, False, "Offered as a minor/specialisation."),
    # ---------------------------------------------------------------- teaching
    ("teaching", "primar", "edu-ph-primar", "Teaching: kindergarten and primary", "Lehrdiplom Kindergarten / Primarstufe", "PH", ALL_PH, "open", 3, 7500, 8600, 0.5, 10, False, "Direct admission with a gymnasial Matura. Strong teacher shortage."),
    ("teaching", "sek1", "edu-ph-unterricht-sekundarstufe-1", "Teaching: lower secondary", "Lehrdiplom Sekundarstufe I", "PH", ["PHZH", "PHBERN", "PHLU", "PHSG", "PHFHNW", "PHZG", "HEPVD", "HEPBEJUNE", "HEPFR", "HEPVS", "SUPSI", "UNIGE"], "open", 4.5, 8200, 9500, 0.5, 12, False, None),
    ("teaching", "sek2", "edu-uh-lehrdiplom-maturitaetsschulen", "Teaching: Gymnasium (upper secondary)", "Lehrdiplom für Maturitätsschulen", "UH", ["ETHZ", "UZH", "UNIBE", "UNIBAS", "UNIGE", "UNIFR", "HEPVD", "HEPBEJUNE", "PHZH", "PHFHNW", "PHSG", "SUPSI"], "open", 6, 9200, 11000, 1.5, 15, False, "Subject master (UH) plus a teaching diploma (~1 year)."),
    ("teaching", "sonderpaedagogik", "edu-ph-sonderpaedagogik", "Special needs education (master)", "Sonderpädagogik (Master)", "PH", ["HFH", "PHFHNW", "PHBERN", "PHLU", "UNIFR", "HEPVD"], "open", 5, 8300, 9500, 0.5, 8, True, "Usually after a teaching diploma."),
    # ---------------------------------------------------------------- arts, design, music
    ("arts", "musik", "edu-fh-musik", "Music", "Musik", "FH", ["ZHDK", "HKB", "FHNW", "HSLU", "HESSO", "SUPSI"], "selection", 5, 4900, 6800, 6.0, 8, False, "Entrance audition. The master is the usual exit degree (performance or music pedagogy)."),
    ("arts", "bildende-kunst", "edu-fh-bildende-kunst", "Fine arts", "Bildende Kunst", "FH", ARTS, "selection", 3, 3800, 5200, 10.0, 10, False, "Portfolio; incomes are often low and irregular."),
    ("arts", "design", "edu-fh-design", "Design", "Design", "FH", ARTS, "selection", 3, 5000, 6500, 7.0, 10, False, "Portfolio and aptitude test."),
    ("arts", "visuelle-kommunikation", "edu-fh-visuelle-kommunikation", "Visual communication", "Visuelle Kommunikation", "FH", ["ZHDK", "HKB", "FHNW", "HSLU", "HESSO", "SUPSI"], "selection", 3, 5100, 6700, 6.5, 10, False, None),
    ("arts", "film", "edu-fh-film", "Film", "Film", "FH", ["ZHDK", "HSLU", "HESSO"], "selection", 3, 4500, 6000, 9.0, 10, False, None),
    ("arts", "theater-tanz", "edu-fh-theater-tanz", "Theatre and dance", "Theater, Tanz", "FH", ["ZHDK", "HKB", "HESSO", "SUPSI"], "selection", 5, 4300, 5800, 9.0, 8, False, "Audition; very selective."),
    ("arts", "literarisches-schreiben", "edu-fh-literarisches-schreiben", "Creative writing", "Literarisches Schreiben", "FH", ["HKB"], "selection", 3, 3800, 5000, 10.0, 10, False, None),
    ("arts", "kunstvermittlung", "edu-fh-kunstvermittlung", "Art education", "Kunst & Vermittlung", "FH", ["ZHDK", "HKB", "HSLU"], "selection", 3, 5500, 7300, 4.0, 10, False, "With a teaching diploma: visual arts teacher at schools."),
    ("arts", "innenarchitektur", "edu-fh-innenarchitektur", "Interior architecture", "Innenarchitektur", "FH", ["HSLU", "HESSO"], "selection", 3, 5500, 7000, 4.0, 12, False, None),
    ("arts", "konservierung", "edu-fh-konservierung-restaurierung", "Conservation and restoration", "Konservierung, Restaurierung", "FH", ["HKB", "HESSO", "SUPSI"], "selection", 5, 5200, 6800, 5.0, 10, False, "The master is required for professional practice."),
]

GROUPS = {
    "medicine": ("Medicine and health (university)", "Medizin und Gesundheit (Universität)"),
    "health": ("Health professions (FH)", "Gesundheitsberufe (FH)"),
    "science": ("Natural sciences and mathematics", "Naturwissenschaften und Mathematik"),
    "computing": ("Computer science", "Informatik"),
    "engineering": ("Engineering, architecture and life sciences", "Technik, Architektur und Life Sciences"),
    "business": ("Business, economics and law", "Wirtschaft und Recht"),
    "social": ("Social sciences, psychology and social work", "Sozialwissenschaften, Psychologie, Soziale Arbeit"),
    "humanities": ("Humanities and languages", "Geistes- und Sprachwissenschaften"),
    "teaching": ("Teaching", "Lehrberufe"),
    "arts": ("Arts, design and music", "Kunst, Design und Musik"),
}


# Regional pay level where graduates typically work (own estimate informed by BFS LSE regional
# medians; 1.00 = Swiss median). Applied in full for FH/PH graduates (mostly work in the region)
# and at half strength for university/ETH graduates (nationally mobile).
REGION = {
    "ETHZ": 1.06, "UZH": 1.06, "ZHAW": 1.06, "ZHDK": 1.06, "KALAIDOS": 1.06, "HFH": 1.06, "PHZH": 1.06,
    "UNIBAS": 1.05, "FHNW": 1.03, "PHFHNW": 1.03, "UNIGE": 1.04,
    "EPFL": 1.01, "UNIL": 1.01, "HEPVD": 1.01, "HESSO": 0.99,
    "UNIBE": 0.98, "BFH": 0.98, "HKB": 0.98, "PHBERN": 0.98, "EHSM": 0.98,
    "UNIFR": 0.97, "HEPFR": 0.97, "UNINE": 0.96, "HEPBEJUNE": 0.96, "HEPVS": 0.94,
    "UNILU": 1.00, "HSLU": 1.00, "PHLU": 1.00, "PHZG": 1.02, "PHSZ": 0.98,
    "UNISG": 1.03,  # most HSG graduates work in Zurich/Geneva, not eastern Switzerland
    "OST": 0.97, "PHSG": 0.97, "PHTG": 0.96, "PHSH": 0.98,
    "FHGR": 0.95, "PHGR": 0.95, "USI": 0.86, "SUPSI": 0.86, "UNIDIST": 1.00,
}

# Where an institution is clearly stronger in a field with employers: (premium on pay, note).
# Premium = own estimate of the pay advantage over the programme average, before regional level.
STRONG = {
    ("bwl-uh", "UNISG"): (0.12, "HSG: Switzerland's leading business school (top FT rankings); strongest recruiting pipeline to banks, consulting and Big Four."),
    ("bwl-uh", "UZH"): (0.03, "Banking & finance specialisation next to the Zurich financial centre."),
    ("bwl-uh", "UNIL"): (0.03, "HEC Lausanne: finance and actuarial science with strong industry links."),
    ("bwl-uh", "UNIGE"): (0.02, "GSEM: finance, commodity trading hub Geneva."),
    ("vwl-uh", "UNISG"): (0.06, "HSG economics feeds into banking, consulting and policy."),
    ("vwl-uh", "UZH"): (0.04, "Top-ranked economics research department in Switzerland."),
    ("vwl-uh", "UNIL"): (0.02, "HEC Lausanne economics."),
    ("recht", "UNISG"): (0.04, "Business law and law & economics; strong ties to commercial law firms."),
    ("recht", "UZH"): (0.03, "Largest law faculty; Zurich business law firms recruit heavily."),
    ("recht", "UNIGE"): (0.03, "International and commercial law, Geneva arbitration hub."),
    ("internationale-studien", "UNIGE"): (0.05, "Next to the UN and international organisations in Geneva."),
    ("internationale-studien", "UNISG"): (0.05, "International Affairs with business focus."),
    ("wirtschaftsinformatik-uh", "UNISG"): (0.06, "HSG business information systems; strong consulting placement."),
    ("wirtschaftsinformatik-uh", "UZH"): (0.02, None),
    ("informatik-uh", "UZH"): (0.02, None),
    ("informatik-uh", "USI"): (0.0, "Strong AI research (IDSIA); pay level of Ticino is lower."),
    ("informatik-eth", "ETHZ"): (0.0, "Global top-10 computer science."),
    ("informatik-eth", "EPFL"): (0.0, "Global top-20 computer science."),
    ("mathematik", "ETHZ"): (0.05, "Global top mathematics; strong demand from finance and insurance."),
    ("mathematik", "EPFL"): (0.04, None),
    ("physik", "ETHZ"): (0.05, "Global top physics."),
    ("physik", "EPFL"): (0.04, None),
    ("chemie", "ETHZ"): (0.05, "Global top chemistry; pharma and chemical industry recruit directly."),
    ("chemie", "EPFL"): (0.03, None),
    ("chemie", "UNIBAS"): (0.02, "Basel chemical and pharma cluster."),
    ("biologie", "ETHZ"): (0.03, None),
    ("biologie", "UNIBAS"): (0.03, "Biozentrum; Basel life-sciences cluster."),
    ("pharmazie", "UNIBAS"): (0.02, "Basel pharma hub."),
    ("pharmazie", "ETHZ"): (0.02, None),
    ("architektur-eth", "ETHZ"): (0.04, "Internationally top-ranked architecture school."),
    ("architektur-eth", "EPFL"): (0.03, None),
    ("elektrotechnik-eth", "ETHZ"): (0.02, None),
    ("maschinenbau-eth", "ETHZ"): (0.02, None),
    ("mikrotechnik", "EPFL"): (0.0, "Swiss reference for micro- and precision engineering (watch and medtech industry)."),
    ("forensik", "UNIL"): (0.0, "Internationally renowned school of criminal sciences."),
    ("uebersetzen-uh", "UNIGE"): (0.0, "FTI Geneva: renowned interpreting school (UN, EU)."),
    ("hospitality", "HESSO"): (0.0, "EHL Lausanne: ranked among the best hospitality schools worldwide."),
    ("bwl-fh", "HSLU"): (0.02, "Banking & finance specialisation."),
    ("bwl-fh", "ZHAW"): (0.02, "School of Management and Law, close to the Zurich job market."),
    ("design", "ZHDK"): (0.03, "Largest Swiss art university."),
    ("design", "HESSO"): (0.03, "ECAL Lausanne: internationally renowned design school."),
    ("visuelle-kommunikation", "ZHDK"): (0.03, None),
    ("visuelle-kommunikation", "HESSO"): (0.03, "ECAL / HEAD Genève."),
    ("film", "ZHDK"): (0.03, None),
    ("film", "HESSO"): (0.03, "ECAL / HEAD Genève."),
    ("musik", "ZHDK"): (0.02, None),
    ("musik", "FHNW"): (0.02, "Musik-Akademie Basel incl. Schola Cantorum (early music, world reference)."),
    ("humanmedizin", "UZH"): (0.0, "Hospital pay follows cantonal scales; the university barely affects pay."),
}

ids = set()
programmes = []
for row in P:
    g, pid, ent, en, de, typ, unis, adm, years, pay1, pay5, unemp, drop, master_only, note = row
    assert g in GROUPS and pid not in ids, pid
    ids.add(pid)
    for u in unis:
        assert u in INST and u in REGION, (pid, u)
    assert adm in ("open", "ems", "selection", "work"), pid
    offers = []
    for u in unis:
        prem, note2 = STRONG.get((pid, u), (None, None))
        offers.append({"institution": u, "strong": (pid, u) in STRONG and (prem > 0 or note2 is not None), "premium": prem or 0.0, **({"note": note2} if note2 else {})})
    assert 3000 <= pay1 <= pay5 <= 15000 and 0 <= unemp <= 15 and 0 <= drop <= 50, pid
    programmes.append({
        "id": pid, "group": g, "entity": ent, "name": {"en": en, "de": de}, "type": typ,
        "institutions": unis, "admission": adm, "years": years, "masterOnly": master_only,
        "offers": offers,
        "estimate": {"payEntry": pay1, "payMid": pay5, "unemployment": unemp, "nonCompletion": drop},
        **({"note": note} if note else {}),
    })

out = {
    "about": __doc__.strip().split("\n")[0],
    "sourceUrl": "https://www.studyprogrammes.ch/",
    "year": 2026,
    "groups": {k: {"en": v[0], "de": v[1]} for k, v in GROUPS.items()},
    "institutions": {k: {"name": v[0], "short": v[1], "type": v[2], "city": v[3], "languages": v[4], "url": v[5], "regionPay": REGION[k]} for k, v in INST.items()},
    "programmes": programmes,
}
for (pid, u) in STRONG:
    assert any(p["id"] == pid and u in p["institutions"] for p in programmes), (pid, u)
dst = ROOT / "data" / "inputs" / "higher-ed-programmes.json"
dst.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {dst.relative_to(ROOT)}: {len(programmes)} programmes, {len(INST)} institutions")
