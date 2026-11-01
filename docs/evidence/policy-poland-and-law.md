# Factors C: national law, enforcement and Polish context

Slice: national drug law, enforcement and Polish context, extracted from the user's library at
`/Volumes/2TB/Data/Cloud/MEGA-Sync/MEGAsync/Chemical Safety/Wiedza/`. Nothing in the source folders was modified.
Abbreviations: UoPN = Polish Act on Counteracting Drug Addiction (ustawa o przeciwdziałaniu narkomanii), 1997 Act = Act of 24.04.1997, 2005 Act = Act of 29.07.2005 (Dz.U. Nr 179 poz. 1485), NPS/NSP = new psychoactive substances, MS = Ministry of Justice statistics unit (Wydział Statystycznej Informacji Zarządczej).

Method: xlsx read with openpyxl (data_only) in a scratch venv, run with `python -I`. PDFs extracted with pypdf (page numbers below are PDF page indices, which match printed numbering only where stated). PNG charts read visually; values marked "approx." are read off a chart. Shares and ratios are my own arithmetic on the cited cells.

---

## 1. The xlsx series (folder `narkopolityka/`)

### 1.1 `stare_082_30_2018 informacja w zakresie ustaw o przewdział. narkomani.xlsx`, sheet `2002-2017`

- Measures: final (prawomocne) convictions of adults, by main offence ("czyn główny"), counts of persons. Source: MS, modified 29.01.2018 (cell Q1).
- Years: 2002-2016 in columns B-P (header row 4). Column Q (2017) is labelled "Skazania osób dorosłych w I inst." (first-instance convictions, not final) and most rows are "b.d." (no data).
- Duplicate: `skazania-prawomocne---dorosli---w-latach-2002-2016---t.-05.02.2018.xlsx`, sheet `2002-2016`, holds the same 2002-2016 values (total row 11, 2005 Act art. 62 at rows 199-201). Use either; numbers agree.

| Year | All adult convictions (row 10) | 2005 Act total (row 90) | Art. 62 ust. 1 / 2 / 3 (rows 115-117) | Possession (art. 62 ust. 1-3) | Share of drug-law convictions | Drug-law share of all convictions |
|---|---|---|---|---|---|---|
| 2006 | 462,937 | 19,652 | 9,666 / 515 / 2,734 | 12,915 | 65.7% | 4.2% |
| 2007 | 426,377 | 20,639 | 10,448 / 588 / 3,170 | 14,206 | 68.8% | |
| 2008 | 420,729 | 20,474 | 10,018 / 619 / 2,846 | 13,483 | 65.9% | |
| 2009 | 415,272 | 19,928 | 9,835 / 670 / 2,518 | 13,023 | 65.4% | |
| 2010 | 432,891 | 20,559 | 9,638 / 772 / 2,623 | 13,033 | 63.4% | 4.7% |
| 2011 | 423,464 | 21,008 | 9,864 / 900 / 2,824 | 13,588 | 64.7% | |
| 2012 | 408,107 | 19,140 | 8,507 / 893 / 2,265 | 11,665 | 60.9% | |
| 2013 | 353,208 | 18,096 | 8,060 / 1,024 / 2,199 | 11,283 | 62.4% | |
| 2014 | 295,353 | 17,403 | 8,006 / 1,063 / 2,156 | 11,225 | 64.5% | |
| 2015 | 260,034 | 16,331 | 7,307 / 1,156 / 2,008 | 10,471 | 64.1% | 6.3% |
| 2016 | 289,512 | 19,386 | 9,382 / 1,524 / 2,236 | 13,142 | 67.8% | 6.7% |
| 2017 (1st instance) | 264,374 | 18,485 (Q90) | art. 62 all: 12,481 (Q114) | 12,481 | 67.5% | 7.0% |

Notes on the 2005 Act articles (labels only, as in the sheet): art. 62 ust. 1 basic possession, ust. 2 significant quantity, ust. 3 lesser-gravity case (wypadek mniejszej wagi). Art. 58/59 are supply/sale (udzielanie), art. 63 cultivation, art. 53-56 manufacture/trafficking.

Pre-2006 (1997 Act, art. 48 ust. 1-3 = possession, rows 76-78; 1997 Act total row 48; 2005 Act from row 90 for 2005):

| Year | Drug-law convictions | Possession convictions | Share |
|---|---|---|---|
| 2002 | 6,384 | 2,818 | 44.1% |
| 2003 | 9,855 | 5,191 | 52.7% |
| 2004 | 16,648 | 9,714 | 58.3% |
| 2005 (both Acts) | 20,207 | 12,762 | 63.2% |

Other trends in the same sheet (2006 vs 2016, columns F vs P):
- Art. 62 ust. 2 (significant quantity): 515 to 1,524 (x2.96), while ust. 1 was roughly flat (9,666 to 9,382).
- Art. 63 ust. 1 (cultivation): 269 to 739; art. 63 ust. 3: 13 to 332 (rows 118, 120). Rising enforcement against home cultivation.
- Art. 59 ust. 1 (supply for gain): 2,533 to 1,446 (row 107). Art. 58 ust. 1 (supply): 1,050 to 600 (row 105). Supply convictions fell while possession stayed flat, so the enforcement mix shifted further toward users.

### 1.2 `skazania-prawomocne---dorosli-wg--rodzajow-przestepstw-i-wymiaru-kary-w-l--2008-2016--19.07.2017.xlsx`, sheets `2008`-`2016`

- Measures: final adult convictions by offence and penalty type. Columns: C = fine only (grzywna samoistna), Y = restriction of liberty (ograniczenie wolności), prison total = AK (2008-2013), AL (2014), AY (2015-2016); suspended prison = AM / AN / BA; unsuspended prison (2015-2016) = AZ, otherwise prison minus suspended.
- Art. 62 ust. 1 rows: 2008 r131, 2011 r122, 2014 r143, 2015 r150, 2016 r146.

| Year | Art. 62 ust. 1 convicted | Fine only | Restriction of liberty | Prison (all) | Prison unsuspended |
|---|---|---|---|---|---|
| 2008 | 10,018 | 1,488 (14.9%) | 955 (9.5%) | 7,541 (75.3%) | 499 (5.0%) |
| 2011 | 9,864 | 2,080 (21.1%) | 1,229 (12.5%) | 6,551 (66.4%) | 420 (4.3%) |
| 2014 | 8,006 | 2,135 (26.7%) | 1,291 (16.1%) | 4,579 (57.2%) | 310 (3.9%) |
| 2015 | 7,307 | 2,230 (30.5%) | 1,210 (16.6%) | 3,860 (52.8%) | 353 (4.8%) |
| 2016 | 9,382 | 4,544 (48.4%) | 2,588 (27.6%) | 2,210 (23.6%) | 543 (5.8%) |

Art. 62 ust. 2 (significant quantity) stays almost entirely custodial: 2016 1,304 of 1,524 prison (85.6%), 396 unsuspended (sheet `2016`, row 147, AY/AZ).
Caveat: the sharp 2015-2016 drop in (mostly suspended) prison sentences coincides with sentencing-law changes, but the folder does not document that cause.

### 1.3 `wyk_1997_2012.xlsx` (one sheet per year 1997-2012)

- Measures: offences detected by police (przestępstwa wykryte), counts of offences.
- Possession row (C2 in sheets 1999-2012, labelled "29.07.05 ... ART.62 ust.1,3" even for pre-2005 years, i.e. relabelled 1997 Act art. 48 ust. 1,3; 1998 sheet C4, 1997 sheet C5):

| Year | Detected possession offences (art. 48/62 ust. 1,3) |
|---|---|
| 1997 | 27 (1997 Act in force only part of the year) |
| 1998 | 1,258 |
| 1999 | 1,672 |
| 2000 | 2,420 |
| 2001 | 5,976 |
| 2002 | 11,130 |
| 2003 | 17,694 |
| 2004 | 24,642 |
| 2005 | 29,388 |
| 2006 | 32,972 |
| 2008 | 28,788 |
| 2010 | 33,153 |
| 2011 | 34,702 |
| 2012 | 35,360 |

A 14.6x rise 2000-2005. The folder does not document the legal or policing cause of this inflection; any explanation (for example a change in small-quantity rules around 2000) would need verification outside this folder.

### 1.4 `2013 - 2018 wybrane art.xlsx`

Sheet `wykryte` (detected offences, 2013-2017 plus Jan-Feb 2018, columns C-H):
- Art. 62 ust. 1 (row 43): 33,628 / 29,884 / 26,668 / 30,127 / 31,838 / 5,107 (Jan-Feb 2018).
- Art. 62 ust. 1-3 as share of all listed 2005 Act articles (rows 35-45): 2013 57.6%, 2014 60.6%, 2015 64.6%, 2016 66.4%, 2017 65.0% (38,667 of 59,499 in 2017).
- Art. 165 par. 1 pkt 2 Penal Code (row 7): 1,896 in 2013, then 6 / 19 / 19 / 99. Anomalous spike; the folder does not say why (cannot confirm a link to legal-high shop prosecutions).

Sheet `umorzone` (prosecutorial proceedings concluded, and how; column D = concluded, T = motion to discontinue under art. 62a, L = no elements of offence, K = negligible social harm):

| Year | Art. 62 ust. 1 concluded (D) | of which art. 62a (T) | Share | Art. 62 ust. 3 concluded | art. 62a | Share | Rows |
|---|---|---|---|---|---|---|---|
| 2013 | 20,462 | 1,440 | 7.0% | 2,135 | 432 | 20.2% | 24, 26 |
| 2014 | 22,381 | 2,604 | 11.6% | 2,740 | 663 | 24.2% | 45, 47 |
| 2015 | 23,452 | 4,198 | 17.9% | 3,265 | 1,181 | 36.2% | 62, 64 |
| 2016 | 25,694 | 6,071 | 23.6% | 4,183 | 1,725 | 41.2% | 79, 81 |
| 2017 | 26,479 | 6,309 | 23.8% | 4,285 | 1,985 | 46.3% | 95, 97 |
| Jan-Feb 2018 | 3,530 | 798 | 22.6% | 636 | 324 | 50.9% | 108, 110 |

Combined art. 62 ust. 1+3: 8.3% (2013) to 27.0% (2017) discontinued under art. 62a.
Key reading: art. 62a discontinuation rose roughly 3.4x in share over 2013-2017, yet detected art. 62 ust. 1 offences did not fall (33,628 in 2013 vs 31,838 in 2017) and concluded proceedings rose (20,462 to 26,479). Discretionary discontinuation reduced convictions per contact, not police contacts.

### 1.5 `zak_umo_1999_2012.xlsx` (one sheet per year 1997-2012)

- Measures: proceedings concluded and selected discontinuation grounds, possession row 4 (art. 48 ust. 1,3 to 2004; art. 62 ust. 1,3 from 2005).
- Concluded possession proceedings: 1999 1,294 (C4) ; 2004 12,650 ; 2005 15,941 ; 2008 17,061 ; 2010 17,543 ; 2011 19,407 ; 2012 20,522.
- No art. 62a column exists before 2013. The first full year after the 2011 amendment shows jumps in two generic grounds: "other reasons excluding prosecution" (F4) 328 (2011) to 1,264 (2012), and "pointlessness of adjudication" (L4) 33 (2011) to 645 (2012); "negligible social harm" (I4) 402 to 600. Plausibly art. 62a cases recorded under generic codes, but the sheet does not say so.
- Art. 62a itself: the folder gives no legal text or in-force date; the amendment date (2011) comes from the task brief, not from the folder.

### 1.6 `infogram.png` (SIN chart, police and court series 2006-2017; values approx.)

Police-concluded UoPN proceedings ~25,800 (2006) to ~35,300 (2017); of which art. 62.1 + 62.3 ~17,600 (2006) to ~30,700 (2017); all UoPN convicted ~19,600 (2006), ~16,300 (2015), ~19,400 (2016); convicted for possession ~12,300 (2006), ~9,400 (2015), ~11,600 (2016). Visual message: police possession proceedings rose ~75% while possession convictions fell or stayed flat, which is consistent with 1.4. Note the chart's possession conviction values look like art. 62.1+62.3 only (exclude ust. 2), slightly below the table in 1.1.

### 1.7 `zatrucia.png` (NIK compilation from GIS, national toxicology consultant and NFZ)

| Year | Reported NPS poisonings/suspected poisonings | Treatment spending (thousand PLN) |
|---|---|---|
| 2010 | 562 | 945.3 |
| 2011 | 176 | 454.0 |
| 2012 | 279 | 760.7 |
| 2013 | 1,079 | 1,346.6 |
| 2014 | 2,513 | 2,097.4 |
| 2015 | 7,358 | 4,634.5 |
| 2016 | 4,369 | 2,965.8 |
| 2017 | 4,324 (preliminary, SIN/MZ) | n/a |

Annotated legal events on the chart: 2010 GIS decision closing shops plus Act of 8 October 2010 amending UoPN and the State Sanitary Inspection Act; Act of 15 April 2011 (list extension) in force 8 June 2011; Act of 24 April 2015 (list extension) in force 1 July 2015.

---

## 2. Factor table

Direction key: + increases, - decreases, 0 no clear effect, ? unclear. Outcomes: D = demand (use), A = attendance at services, U = unmet need, H = adverse outcomes (health), E = enforcement contacts.

### F1. Criminal liability for possession of any quantity (Polish model)
- Level: national_law
- Direction: E +; A - (via fear of legal consequences); U +; H ? (indirect); D 0 (see F4).
- Evidence type: national administrative statistics (convictions, detections); clinical guidance observation.
- Figures: Poland, possession = 60.9-68.8% of all drug-law convictions 2006-2016 (12,915 in 2006; 13,142 in 2016) and 67.5% of first-instance drug-law convictions 2017; drug-law convictions grew from 1.7% (2002) to 6.7% (2016) of all adult convictions. Detected possession offences 35,360 (2012), 31,838 art. 62 ust. 1 alone (2017). In NPS poisonings, under 20% of patients give the substance name, and information may be false out of fear the substance is controlled and has legal consequences.
- Caveats: no substance split (cannabis vs others) in any sheet; adults only; final convictions lag offences. Disclosure statement is expert opinion, not measured.
- Citation: `narkopolityka/stare_082_30_2018 ... .xlsx` sheet `2002-2017` rows 10, 90, 115-117, Q90, Q114; `wyk_1997_2012.xlsx` sheet `2012` C2; `2013 - 2018 wybrane art.xlsx` sheet `wykryte` row 43; `_polskie/Poradnik NSP DRUK.pdf` p. 11.

### F2. Prosecutorial discontinuation for small amounts (art. 62a, de jure discretion)
- Level: national_law (implemented by enforcement_policing / prosecutors)
- Direction: E 0 at police level (detections not reduced), convictions -; A ? (no data); D ? (no data).
- Evidence type: national administrative statistics.
- Figures: share of concluded art. 62 ust. 1 proceedings ended under art. 62a: 7.0% (2013), 11.6% (2014), 17.9% (2015), 23.6% (2016), 23.8% (2017); art. 62 ust. 3: 20.2% to 46.3%. Detected art. 62 ust. 1: 33,628 (2013) vs 31,838 (2017). Possession convictions 2012-2015 fell (11,665 to 10,471) then rebounded to 13,142 (2016).
- Caveats: discretionary, not decriminalisation; uptake grew slowly; pre-2013 sheets lack an art. 62a code (generic grounds jumped in 2012). Model it as a "conviction filter" applied after a police contact, not as fewer stops.
- Citation: `2013 - 2018 wybrane art.xlsx` sheet `umorzone` cols D and T, rows 24-26, 45-47, 62-64, 79-81, 95-97, 108-110; sheet `wykryte` C43:G43; `zak_umo_1999_2012.xlsx` sheets `2011`, `2012` row 4 (F, I, L).

### F3. Penalty mix for possession
- Level: enforcement_policing (sentencing)
- Direction: H + for those convicted (social costs, see F5), E 0.
- Evidence type: national administrative statistics.
- Figures: art. 62 ust. 1 prison share (mostly suspended) 75.3% (2008) to 23.6% (2016); fines 14.9% to 48.4%; unsuspended prison stable at 3.9-5.8% (310-543 persons/yr). Art. 62 ust. 2: 85.6% prison in 2016, 396 unsuspended.
- Caveats: causes of 2015-2016 shift not documented in folder.
- Citation: `skazania-...-wymiaru-kary-w-l--2008-2016--19.07.2017.xlsx` sheets `2008` r131, `2011` r122, `2014` r143, `2015` r150, `2016` r146-147.

### F4. Penalty severity has little deterrent effect on use
- Level: national_law
- Direction: D 0 (raising penalties does not reduce demand); H + and E + for those caught.
- Evidence type: review of criminological research (secondary, cites MacCoun 1993).
- Figures: none quantitative for deterrence; US context: 1986-1996 federal drug sentences for African Americans rose from 11% to 49% higher than for whites; women in prison for drugs +421%.
- Caveats: largely US evidence; summarised by a harm-reduction review.
- Citation: `HR Drug Checking/2004_NEIL_HUNT_harm reduction review.pdf` pp. 28 (section 3.4.1).

### F5. Social cost of a criminal record for minor possession
- Level: national_law -> individual
- Direction: H + (employment, housing, relationships, travel, further legal trouble); U +; community_attitudes_stigma +.
- Evidence type: observational follow-up studies (Lenton et al) summarised in review.
- Figures: civil-penalty scheme "no worse" at deterring cannabis use among those apprehended, with far smaller adverse social impact (Western Australia / South Australia comparison, up to 10 years post apprehension). No numeric effect size in the folder.
- Citation: Hunt 2004 pp. 27-28 (3.4.1); p. 7 ("Harms caused by criminalisation").

### F6. Depenalisation / civil penalties for cannabis possession
- Level: national_law
- Direction: D 0 (no increase in use), E ? (can rise through net-widening), H - (social harms down), A ? (no data).
- Evidence type: natural-experiment policy studies summarised in review.
- Figures: 11 US states depenalised cannabis in the 1970s (Alaska recriminalised 1990); four controlled studies found no greater increase in adult or adolescent use. South Australia Cannabis Expiation Notice (1987): weekly use, young-adult and school-student use did not rise faster than in other states; only 45% of fines paid by due date; easier notices led to a significant rise in notices issued (net-widening), raising the number at risk of criminal sanction for non-payment, hitting low-income people. Public, police and judiciary in South Australia did not want to return to criminal penalties.
- Caveats: pre-2004 evidence; cannabis only; Hunt notes applicability to other drugs is unknown.
- Citation: Hunt 2004 pp. 27-29 (3.4, 3.4.2, 3.4.3, 3.4.4).

### F7. Commercial access to cannabis (Dutch coffeeshop tolerance)
- Level: national_law / drug_market_supply
- Direction: D 0 for reduced penalties (1976-1992); D + (suggestive) when commercial outlets grew (1992-1996); H - via separation from other illicit drug markets.
- Evidence type: cross-national comparison and time series (MacCoun and Reuter) summarised in review.
- Figures: Dutch use not higher than in other European countries or the USA despite coffeeshops; growth 1992-1996 brought rates up but not above the USA. No numbers given in the folder.
- Caveats: this is de facto tolerance under formal prohibition, not a legal regulated market.
- Citation: Hunt 2004 pp. 28-29 (3.4.2).

### F8. Legal status of drug checking / pill testing
- Level: national_law (with local prosecutor and municipal layers)
- Direction: A + where legal and police-supported; U + where illegal or result feedback is banned.
- Evidence type: country fact files (descriptive, EMCDDA 2001).
- Figures: Austria (ChEck iT!, since April 1997): legal if done by a scientific institution; staff may not handle substances. Belgium (Modus Vivendi, 2001): accepted by federal health ministry as research, feedback legality unclear, no local acceptance. France: pill testing generally illegal yet state-subsidised (SINTES, Techno Plus, Mission XTB); no content feedback except very dangerous pills. Germany: generally not allowed; operation depends on local prosecutors and police (DROBS Hannover by special agreement; Eve and Rave Berlin investigations dropped after Berlin court decisions 1998 and 1999). Netherlands (DIMS since 1992): official policy approved by parliament, special agreements with Ministry of Justice and prosecutors, no testing for obvious dealers. Spain (Energy Control, since July 1997): legally unclear but supported by Barcelona city and police. Switzerland (Pilot E, Bern): permitted after legal opinions, publicly subsidised pilots 1997/98 and 1998/99, no quantitative results for "obvious dealers". The 2011 NEWIP guidelines defer the legal framework to a separate document (not in folder) and note that some countries require special authorisation to transport samples to a laboratory and that only authorised laboratories may hold reference standards.
- Caveats: 2001 snapshot; no attendance counts by legal regime; no Polish entry.
- Citation: `HR Drug Checking/2001_EMCDDA_Pill_Testing_Fact_Files.pdf` pp. 4-12; `2011_EU_NEWIP_Guidelines for Drug Checking Methodology.pdf` pp. 4, 5, 7.

### F9. Police presence at venues and services
- Level: enforcement_policing (also venue_nightlife)
- Direction: visible hostile policing A - (deters attendance), E +; cooperative non-targeting policing A + / neutral.
- Evidence type: descriptive fact files.
- Figures: Belgium: local police disapproved and discouraged users from attending testing "by showing massive physical presence". Austria: police present at raves but do not concentrate on ChEck iT! visitors. Barcelona and Bern: police support the projects. No quantified attendance effect.
- Citation: EMCDDA 2001 Fact Files pp. 4, 5, 11, 12.

### F10. Banning legal highs: displacement, substitution and price
- Level: national_law -> drug_market_supply
- Direction: short-term H - possible after shop closures; medium-term D 0 and H + via substitution with less known analogues; market moves online or to street dealers.
- Evidence type: national poisoning surveillance series, forensic sample analysis, narrative reviews.
- Figures: UK mephedrone ban (2010): new substitutes (naphyrone "NRG-1", "Ivory Wave", MDAI); mephedrone still easy to obtain but from street dealers at about double the price (~20 GBP/g); most "NRG-1" products contained mephedrone and other cathinones instead of naphyrone. Poland: mephedrone controlled by Act of 10 June 2010 (Dz.U. 2010 nr 143 poz. 962), still orderable online from foreign shops afterwards; 31 of 307 powders/capsules/tablets seized in head shops contained mephedrone (Kraków Institute of Forensic Research). Poland NPS poisonings: 562 (2010), 176 (2011, after the October 2010 shop closures), then 279, 1,079, 2,513, 7,358 (2015 peak), 4,369 (2016), 4,324 (2017 prelim); treatment spending 945.3k PLN (2010) to 4,634.5k PLN (2015). OKZ-Warszawa: 19,568 medical interventions 2013-2017; peak in July 2015 linked by the authors to more "dopalacz" products on the market around the 2015 amendment; 60 possibly NPS-related deaths 2013-2017, only 16 toxicologically confirmed. GIS 2018/2019: 4 of top 5 and 8 of top 10 identified NPS were synthetic cathinones, about 75% of analysed samples.
- Caveats: reporting changed (Ministry of Health reporting order October 2010; OKZ registry from 2013), so the series is not homogeneous; two sources differ (NIK 562 for 2010 vs OKZ 339 for Q4 2010 only; 7,358 vs 7,284 for 2015); correlation with legal events is not causal proof.
- Citation: `narkopolityka/zatrucia.png`; `_polskie/Poradnik NSP DRUK.pdf` pp. 6, 8-10; `_polskie/mefedron i jego nowe pochodne.pdf` pp. 1, 5; `_polskie/zawilska-nsp-dopalacze.pdf` p. 7 (file content is Wronikowska and Budzyńska, Postępy Hig Med Dosw 2020;74:57-68).

### F11. Head-shop retail of legal highs (pre-ban market structure)
- Level: drug_market_supply
- Direction: D + (accessibility, price), H + (unknown composition).
- Evidence type: forensic review (Problemy Kryminalistyki 265, 2009).
- Figures: "several dozen" (kilkadziesiąt) head shops in Poland by 2009; first opened late August 2008 in Łódź, after two years of online sales; five BZP tablets cost about 50 PLN; 1,800 BZP tablets (3.5 kg) seized at Okęcie, est. value ~87,000 PLN (press report 14 Feb 2009). At the time BZP was uncontrolled in 20 EU states and Norway, controlled only in Greece, Belgium, Denmark and Malta.
- Caveats: descriptive.
- Citation: `_polskie/dopalacze.pdf` pp. 1, 3.

### F12. Faster scheduling and full criminalisation of NPS (2018 amendment)
- Level: national_law
- Direction: E + (possession up to 3 years, trafficking up to 12); intended D -, H -; health_system_funding + (treatment parity); surveillance + (mandatory reporting).
- Evidence type: legal description in reviews; no outcome evaluation in folder.
- Figures: NPS treated like drugs; mandatory reporting of all (suspected) NPS / substitute-product poisonings to the State Sanitary Inspection; treatment for NPS dependence on equal terms; new substances listed by ministerial regulation rather than statute (faster). NPS list: 21 substances (MZ regulation Aug 2017); Aug 2018 regulation added 38 NPS. Earlier list extensions 2009 (16 plants including Salvia divinorum, Mitragyna speciosa, Catha edulis), 2010, 2015.
- Caveats: authors state effectiveness can only be judged later; no post-2018 data in folder.
- Citation: zawilska-nsp-dopalacze.pdf p. 10; Poradnik NSP p. 6; `_polskie/rośliny kontrolowane ustawą.pdf` p. 1.

### F13. Users do not know what they take
- Level: individual (drives service_design_access demand for drug checking)
- Direction: H +, U + (unmet need for checking).
- Evidence type: 2016 online survey of people who use psychoactive substances, cited in handbook.
- Figures: mephedrone used by 17.7%, 3-MMC 7.1%, alpha-PVP 3.4%, pentedrone 2.9%, ethcathinone 0.8%; almost half of users did not know which substance they used. Head-shop products contained undeclared active substances; labels uninformative.
- Caveats: self-selected online sample; percentages of respondents, not the population.
- Citation: Poradnik NSP pp. 16-18; dopalacze.pdf p. 1.

### F14. Treatment cost burden of NPS poisonings
- Level: health_system_funding
- Direction: H + leads to cost +.
- Figures: see F10 table (945.3k to 4,634.5k PLN, NFZ data via NIK).
- Citation: `narkopolityka/zatrucia.png`.

### F15. Supervised consumption rooms and heroin prescribing: siting and neighbourhood effects
- Level: service_design_access / local_government_planning (partial community evidence)
- Direction: A + for marginalised users; H -; public nuisance -; feasibility depends on consultation with community, police and local government.
- Evidence type: review of evaluations.
- Figures: 39 supervised injecting centres in NL, CH, DE, ES (1999-2000 survey); rejected in Norway and Denmark; Sydney MSIC first 6 months: >1,500 registered, 11,237 visits (~30 min), about 1 in 18 visits led to further help, 50 overdoses managed. Dutch and Swiss heroin trials: no serious public order or safety problems in the surrounding neighbourhood; UK: little or no public order problems. Local policing changes can confound crime outcomes.
- Caveats: this is evidence about actual neighbourhood impact, not about resident attitudes or opposition.
- Citation: Hunt 2004 pp. 23, 30-32.

### F16. Public nuisance and community-level harm
- Level: community_attitudes_stigma
- Direction: open drug scenes and litter reduce real and perceived safety; concentrated in poorer neighbourhoods.
- Evidence type: narrative.
- Figures: none.
- Citation: Hunt 2004 p. 7.

---

## 3. Explicit gaps (no evidence in these folders)

- Legal regulated cannabis markets (recreational legalisation with licensed retail, e.g. post-2012 regimes): no evidence. The only "legal-ish cannabis" evidence is Dutch coffeeshop tolerance and pre-2004 civil-penalty schemes (F6, F7).
- Portuguese 2001 decriminalisation outcomes: not covered (Portugal only named as a diversion example, Hunt p. 27).
- NIMBY / neighbourhood opposition to a nearby service, resident attitude surveys, planning disputes: no data. Only qualitative statements that consumption rooms are feasible when developed in consultation, and evidence that heroin-prescribing clinics did not cause public-order problems.
- Polish harm-reduction service funding, attendance, outreach or club-stand data: none in this slice.
- Substance breakdown of Polish possession cases (cannabis share): the MS sheets do not split by substance.
- Juvenile cases, regional breakdown, stop-and-search or police-contact counts not ending in a recorded offence: absent.
- Polish public opinion on drug policy: absent.
- Legal cause of the 2000-2005 jump in detected possession offences and of the 2013 art. 165 spike: not documented.
- `_PRO_notatki/Zeszyt po polsku.docx`: lab notebook on reagent tests (ninhydrin amphetamine semi-quantitation, formaldehyde-sulfuric MDMA test, cocaine and THC tests). No law, policy or enforcement content.
- Other `_polskie/` files checked and not relevant to law or policy: forensic chemistry papers (amphetamine uncertainty, heroin profiling, cathinone analogues, cannabinoids, hallucinogens), body language, crown witness, pretrial detention (no drug content), administrative nullity brochure. Drug-driving papers (`Badanie śliny...pdf`, `5(1).pdf`) give foreign roadside prevalence data, not Polish enforcement figures.
