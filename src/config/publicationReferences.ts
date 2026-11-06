/** Verified publication titles and identifiers. Original library locators stay in the source contracts.
 * Metadata: source documents, publisher pages and Crossref DOI records; checked 2026-11-04.
 * PDF page locators refer to the library copy, which may differ from published pagination.
 */
export interface PublicationReference { title: string; url?: string; locator?: string; }

const PUBLICATIONS = {
  "drugstore2024": { "title": "Harm Reduction Services for People who Use Psychoactive Substances in Recreational Contexts: Intervention Development and Implementation Guide", "url": "https://region.aph.org.ua/wp-content/uploads/2024/03/harmreductioninrecreationalsettingsinterventionguide.pdf" },
  "p1": {
    "title": "An inventory of on-site pill-testing interventions in the EU: Fact files"
  },
  "p2": {
    "title": "An inventory of on-site pill-testing interventions in the EU"
  },
  "p3": {
    "title": "On-site pill-testing interventions in the European Union: Executive summary"
  },
  "p4": {
    "title": "A review of the evidence-base for harm reduction approaches to drug use",
    "url": "https://www.neilhunt.org/pdf/2003-evidence-base-for-hr-hunt-et-al.pdf"
  },
  "p5": {
    "title": "Drug Checking: A prevention measure for a heterogeneous group with high consumption frequency and polydrug use — evaluation of Zurich’s drug checking services"
  },
  "p6": {
    "title": "A Pill Too Hard to Swallow? A Public Health and Legislative Consideration of Methods to Reduce Drug-Related Harm in the Victorian Party Scene"
  },
  "p7": {
    "title": "Results of an international drug testing service for cryptomarket users",
    "url": "https://doi.org/10.1016/j.drugpo.2016.04.017"
  },
  "p8": {
    "title": "What’s So ‘New’ About New Psychoactive Substances? Definitions, prevalence, motivations, user groups and a proposed new taxonomy"
  },
  "p9": {
    "title": "Pill testing or drug checking in Australia: Acceptability of service design features",
    "url": "https://doi.org/10.1111/dar.12576"
  },
  "p10": {
    "title": "New Drugs, New Directions? Research priorities for New Psychoactive Substances and Human Enhancement Drugs",
    "url": "https://doi.org/10.1016/j.drugpo.2017.01.016"
  },
  "p11": {
    "title": "The detection and prevention of unintentional consumption of DOx and 25x‐NBOMe at Portugal's Boom Festival",
    "url": "https://doi.org/10.1002/hup.2608"
  },
  "p12": {
    "title": "Drug detection dogs at Australian outdoor music festivals: Deterrent, detection and iatrogenic effects",
    "url": "https://doi.org/10.1016/j.drugpo.2018.08.002"
  },
  "p13": {
    "title": "‘Worth the test?’ Pragmatism, pill testing and drug policy in Australia",
    "url": "https://doi.org/10.1186/s12954-018-0216-z"
  },
  "p14": {
    "title": "Evaluation of a fentanyl drug checking service for clients of a supervised injection facility, Vancouver, Canada",
    "url": "https://doi.org/10.1186/s12954-018-0252-8"
  },
  "p15": {
    "title": "The importance of drug checking outside the context of nightlife in Slovenia",
    "url": "https://doi.org/10.1186/s12954-018-0208-z"
  },
  "p16": {
    "title": "Drug safety testing, disposals and dealing in an English field: Exploring the operational and behavioural outcomes of the UK’s first onsite ‘drug checking’ service"
  },
  "p17": {
    "title": "Piloting the UK’s First Home-Office-Licensed Pharmacist-Led Drug Checking Service at a Community Substance Misuse Service",
    "url": "https://doi.org/10.3390/bs10080121"
  },
  "p18": {
    "title": "Decriminalize Drug-Checking Technologies in Pennsylvania to Prevent Overdose Deaths",
    "url": "https://doi.org/10.38126/JSPG170210"
  },
  "p19": {
    "title": "The effect of public opinion and politics on attitudes towards pill testing: Results from the 2019 Australian Election Study"
  },
  "p20": {
    "title": "A new quantitative drug checking technology for harm reduction: Pilot study in Vancouver, Canada using paper spray mass spectrometry",
    "url": "https://doi.org/10.1111/dar.13370"
  },
  "p21": {
    "title": "Safer Tripping: Serotonergic Psychedelics and Drug Checking. Submission and Detection Rates, Potential Harms, and Challenges for Drug Analysis",
    "url": "https://doi.org/10.1007/s40429-021-00385-5"
  },
  "p22": {
    "title": "The introduction of fentanyl on the US–Mexico border: An ethnographic account triangulated with drug checking data from Tijuana",
    "url": "https://doi.org/10.1016/j.drugpo.2022.103678"
  },
  "p23": {
    "title": "Police-led Fentanyl Test Strip Distribution Program in Maine and Massachusetts: An Evaluation",
    "url": "https://doi.org/10.21203/rs.3.rs-1765388/v1"
  },
  "p24": {
    "title": "The Cathinone Hydra: Increased Cathinone and caffeine adulteration in the English MDMA market after Brexit and COVID-19 lockdowns",
    "url": "https://doi.org/10.1177/20503245221099209"
  },
  "p25": {
    "title": "The Implementation of Drug Checking Services for People Who Use Drugs: A Systematic Review",
    "url": "https://doi.org/10.1111/add.15734"
  },
  "p26": {
    "title": "Adulteration of low‐delta‐9‐tetrahydrocannabinol products with synthetic cannabinoids: Results from drug checking services",
    "url": "https://doi.org/10.1002/dta.3220"
  },
  "p27": {
    "title": "Music festival drug checking: Evaluation of an Australian pilot program",
    "url": "https://doi.org/10.21203/rs.3.rs-1481351/v1"
  },
  "p28": {
    "title": "Drug use patterns, harm reduction strategies and use of drug checking services in boom festival patrons",
    "url": "https://doi.org/10.1108/dhs-01-2022-0004"
  },
  "p29": {
    "title": "Implementing drug checking as an illicit drug market intervention within the supply chain in a Canadian setting",
    "url": "https://doi.org/10.1080/09687637.2022.2087487"
  },
  "p30": {
    "title": "Challenges in Drug Surveillance: Strengthening the Analysis of New Psychoactive Substances by Harmonizing Drug Checking Services in Proficiency Testing",
    "url": "https://doi.org/10.3390/ijerph20054628"
  },
  "p31": {
    "title": "Who supports drug‐checking services in Australia ? An analysis of 2019 National Drug Strategy Household Survey data",
    "url": "https://doi.org/10.1111/dar.13707"
  },
  "p32": {
    "title": "“It would really support the wider harm reduction agenda across the board”: A qualitative study of the potential impacts of drug checking service delivery in Scotland",
    "url": "https://doi.org/10.21428/cb6ab371.3b3e4fad"
  },
  "p33": {
    "title": "Planning and implementing community-based drug checking services in Scotland: a qualitative exploration using the consolidated framework for implementation research",
    "url": "https://doi.org/10.21428/cb6ab371.235fd97b"
  },
  "p34": {
    "title": "Drug Checking: Glimpse into the Recreational Drug Market in Switzerland",
    "url": "https://doi.org/10.2533/chimia.2023.444"
  },
  "p35": {
    "title": "Handheld Raman Spectroscopy in the First UK Home Office Licensed Pharmacist-Led Community Drug Checking Service",
    "url": "https://doi.org/10.3390/ijerph20064793"
  },
  "p36": {
    "title": "Insights from Drug Checking Programs: Practicing Bootstrap Public Health Whilst Tailoring to Local Drug User Needs",
    "url": "https://doi.org/10.3390/ijerph20115999"
  },
  "p37": {
    "title": "Identification of three unexpected new psychoactive substances at an Australian drug checking service",
    "url": "https://doi.org/10.1002/dta.3637"
  },
  "p38": {
    "title": "Adulteration and substitution of drugs purchased in Australia from cryptomarkets: An analysis of Test4Pay",
    "url": "https://doi.org/10.1111/dar.13825"
  },
  "p39": {
    "title": "Poppers, the Politics of Exemption and the Characteristics of Poppers Users in the annual English Festival Study, 2014–23",
    "url": "https://doi.org/10.1093/bjc/azae055"
  },
  "p40": {
    "title": "“The compounds for females are really commonly faked!”: Women's challenges in anabolic steroid acquisition and the place of drug checking interventions",
    "url": "https://doi.org/10.1111/dar.13931"
  },
  "p41": {
    "title": "City-level drug policies in Portugal: the COVID-19 pandemic as an analyser of harm reduction intervention responsiveness in Porto and Lisbon",
    "url": "https://doi.org/10.21203/rs.3.rs-4656985/v1"
  },
  "p42": {
    "title": "Responsibility, Care and Trust Among People Using Drug Checking Services at a Music Festival",
    "url": "https://doi.org/10.1177/00914509241255311"
  },
  "p43": {
    "title": "Impact of Lab-Based Drug Checking Services on Syringe Service Program Engagement in Maryland (preprint)",
    "url": "https://doi.org/10.21203/rs.3.rs-6917005/v1"
  },
  "p44": {
    "title": "Risk communication about high‐dose MDMA: Impact of a hypothetical drug alert on future MDMA use",
    "url": "https://doi.org/10.1111/dar.14037"
  },
  "p45": {
    "title": "ToxiBot: infraestructura digital comunitaria de reducción de daños para el registro y la circulación de resultados de análisis colorimétricos en Argentina"
  },
  "p46": {
    "title": "Understanding Drug and Alcohol Staff Perspectives on the Barriers and Facilitators to Drug Checking: A Qualitative Study",
    "url": "https://doi.org/10.1111/dar.14073"
  },
  "p47": {
    "title": "Probing trends of opioid seizures and drug checking samples under a nascent “decriminalization” framework in Vancouver, Canada",
    "url": "https://doi.org/10.1177/20503245251337361"
  },
  "p48": {
    "title": "Drug Checking Services in Latin America vs. the United States: Staff Perspectives, Program Characteristics, and Barriers to Implementation",
    "url": "https://doi.org/10.64898/2026.04.11.26350657"
  },
  "p49": {
    "title": "Drug sellers' use of a drug checking service amid the overdose crisis in British Columbia, Canada",
    "url": "https://doi.org/10.1111/add.70429"
  },
  "p50": {
    "title": "Source Matters: An Examination of Drug Checking Samples from Police Departments and Community Based Programs in Massachusetts (preprint)",
    "url": "https://doi.org/10.64898/2026.05.08.26352755"
  },
  "p51": {
    "title": "Discordant Drug Checking Results and Risk Reduction Behaviours: Findings From the ChecKnow Study in France",
    "url": "https://doi.org/10.1111/dar.70216"
  },
  "p52": {
    "title": "Understanding Consumption of Illicit Drugs and New Psychoactive Substances in Australia by Triangulating Drug Checking and Wastewater‐Based Epidemiology",
    "url": "https://doi.org/10.1002/dta.70120"
  },
  "p53": {
    "title": "The Drug Information and Monitoring System (DIMS) in the Netherlands: Implementation, results, and international comparison",
    "url": "https://doi.org/10.1002/dta.323"
  },
  "p54": {
    "title": "Cannabis adulterated with the synthetic cannabinoid receptor agonist MDMB-4en-PINACA and the role of European drug checking services",
    "url": "https://doi.org/10.1016/j.drugpo.2021.103493"
  },
  "p55": {
    "title": "Content of ecstasy in the Netherlands: 1993–2008",
    "url": "https://doi.org/10.1111/j.1360-0443.2009.02707.x"
  },
  "p56": {
    "title": "¿Para qué sirve el testado de pastillas (Pill testing)?",
    "url": "https://doi.org/10.20882/adicciones.206"
  },
  "p57": {
    "title": "Análisis in situ de sustancias y adulteraciones. Comentario a Calafat, Juan y Duch (2009)",
    "url": "https://doi.org/10.20882/adicciones.205"
  },
  "p58": {
    "title": "The utility of drug checking services as monitoring tools and more: A response to Pirona et al.",
    "url": "https://doi.org/10.1016/j.drugpo.2017.05.018"
  },
  "p59": {
    "title": "What is needed for implementing drug checking services in the context of the overdose crisis? A qualitative study to explore perspectives of potential service users",
    "url": "https://doi.org/10.1186/s12954-020-00373-4"
  },
  "p60": {
    "title": "Drug Checking at New Zealand Festivals: Final Report",
    "url": "https://openaccess.wgtn.ac.nz/articles/report/Drug_Checking_at_New_Zealand_Festivals_Final_Report_/13936346"
  },
  "p61": {
    "title": "The Bronze Age of drug checking: barriers and facilitators to implementing advanced drug checking amidst police violence and COVID-19",
    "url": "https://doi.org/10.1186/s12954-022-00590-z"
  },
  "p62": {
    "title": "Substance Use Stigma and Community Drug Checking: A Qualitative Study Examining Barriers and Possible Responses",
    "url": "https://doi.org/10.3390/ijerph192315978"
  },
  "p63": {
    "title": "A step change model analysis of the establishment of pill testing in one Australian jurisdiction",
    "url": "https://doi.org/10.1186/s12954-023-00907-6"
  },
  "p64": {
    "title": "First drug-checking study at an electronic festival and fentanyl detection in the central region of Mexico",
    "url": "https://doi.org/10.1186/s12954-023-00905-8"
  },
  "p65": {
    "title": "Chemsex from Drug Checking Services: descriptive study on methamphetamine, mephedrone, and other synthetic cathinones",
    "url": "https://doi.org/10.54108/10072"
  },
  "p66": {
    "title": "A qualitative assessment of key considerations for drug checking service implementation",
    "url": "https://doi.org/10.1186/s12954-023-00882-y"
  },
  "p67": {
    "title": "Contextual factors affecting the implementation of drug checking for harm reduction: a scoping literature review from a North American perspective",
    "url": "https://doi.org/10.1186/s12954-023-00856-0"
  },
  "p68": {
    "title": "Implementation opportunities and challenges to piloting a community-based drug-checking intervention for sexual and gender minority men in Vancouver, Canada: a qualitative study",
    "url": "https://doi.org/10.1186/s12954-024-01004-y"
  },
  "p69": {
    "title": "Nitazene test strips: a laboratory evaluation",
    "url": "https://doi.org/10.1186/s12954-024-01078-8"
  },
  "p70": {
    "title": "Implementation of a community-based LC-UV drug checking service: promising preliminary findings on feasibility and validity",
    "url": "https://doi.org/10.1186/s12954-024-01098-4"
  },
  "p71": {
    "title": "Enhancing drug checking services for supply monitoring: perspectives on implementation in syringe service programs in the USA",
    "url": "https://doi.org/10.1186/s12954-023-00924-5"
  },
  "p72": {
    "title": "Recommendations from people who use drugs in Philadelphia, PA about structuring point-of-care drug checking",
    "url": "https://doi.org/10.1186/s12954-024-00937-8"
  },
  "p73": {
    "title": "‘I will not use it because the results are bad’ – understanding the influence of the drug checking service on changing consumption behavior",
    "url": "https://doi.org/10.1080/09687637.2024.2412995"
  },
  "p74": {
    "title": "UNODC — World Drug Report 2024: Key Findings and Conclusions",
    "url": "https://www.unodc.org/unodc/en/data-and-analysis/world-drug-report-2024.html"
  },
  "p75": {
    "title": "Willingness to use a drug checking service for cannabis and cannabis-based products: results from an online survey of people who regularly use cannabis in France",
    "url": "https://doi.org/10.1186/s12954-025-01274-0"
  },
  "p76": {
    "title": "Community-based drug checking at syringe service programs in New York City observe an increasing prevalence of xylazine from 2021 through 2024",
    "url": "https://doi.org/10.1186/s12954-025-01237-5"
  },
  "p77": {
    "title": "A software framework for infrared spectral analysis in harm reduction drug checking",
    "url": "https://doi.org/10.1080/00952990.2025.2554628"
  },
  "p78": {
    "title": "Implementing community drug checking in smaller urban communities: a qualitative study exploring contextual factors to consider",
    "url": "https://doi.org/10.1186/s12954-025-01234-8"
  },
  "p79": {
    "title": "Utilization of drug checking services in Austria: a cross-sectional online survey",
    "url": "https://doi.org/10.1186/s12954-025-01168-1"
  },
  "p80": {
    "title": "From trash to results: shortcomings and benefits of paraphernalia-based drug checking in Finland",
    "url": "https://doi.org/10.1186/s12954-025-01330-9"
  },
  "p81": {
    "title": "Using RE-AIM to evaluate the implementation of a social marketing and free product distribution project for fentanyl and xylazine test strips in New York State",
    "url": "https://doi.org/10.1186/s12954-025-01259-z"
  },
  "p82": {
    "title": "Implementation of a Police-Led Fentanyl Test Strip Distribution Program in Two US States",
    "url": "https://doi.org/10.1080/10826084.2025.2497946"
  },
  "p83": {
    "title": "Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland: a pilot study",
    "url": "https://doi.org/10.1186/s12954-025-01242-8"
  },
  "p84": {
    "title": "Police Chiefs’ Perspectives on Fentanyl Test Strips",
    "url": "https://doi.org/10.1080/10826084.2025.2515604"
  },
  "p85": {
    "title": "Psychological and socio-structural determinants of intentions to use drug checking services",
    "url": "https://doi.org/10.1177/13591053251321783"
  },
  "p86": {
    "title": "‘It'd Be Nice to Know if You're About to Have Drain Cleaner’: A Qualitative Study of Preferred Drug Checking Service Features to Inform the Design of CheQpoint, Queensland's First Fixed‐Site Drug Checking Service",
    "url": "https://doi.org/10.1111/dar.70003"
  },
  "p87": {
    "title": "Characteristics of take-home fentanyl test strip use and support for drug checking services among people who use heroin in Australia: learnings for an increasingly complex drug market",
    "url": "https://doi.org/10.1186/s12954-025-01205-z"
  },
  "p88": {
    "title": "City-level drug policies in Portugal: the COVID-19 pandemic as an analyzer of harm reduction responsiveness in Porto and Lisbon",
    "url": "https://doi.org/10.1186/s12954-025-01179-y"
  },
  "p89": {
    "title": "Drug-Checking Technologies to Detect Compositions of Unregulated Substance Samples",
    "url": "https://www.ncbi.nlm.nih.gov/books/NBK622172/"
  },
  "p90": {
    "title": "Toward policy punctuation: a content analysis of harm reduction framing in fentanyl test strip policy in Texas",
    "url": "https://doi.org/10.1080/1533256x.2026.2721661"
  },
  "p91": {
    "title": "Australian University Residential College Students’ Awareness of and Attitudes Toward Drug Checking Services",
    "url": "https://doi.org/10.1080/10826084.2026.2698844"
  },
  "p92": {
    "title": "Real time, on-site drug checking in low-threshold housing communities",
    "url": "https://doi.org/10.1186/s12954-026-01397-y"
  },
  "p93": {
    "title": "Risk reduction behaviours following the detection of unexpected drugs through community drug checking: a cross-sectional study",
    "url": "https://doi.org/10.1186/s12954-025-01374-x"
  },
  "p94": {
    "title": "‘I want to know what I’m taking’—long-term evaluation of the drug checking service in Slovenia and its integration into drug policy",
    "url": "https://doi.org/10.1080/09687637.2026.2619697"
  },
  "koning": {
    "title": "Visitors of the Dutch drug checking services: Profile and drug use experience",
    "url": "https://doi.org/10.1016/j.drugpo.2021.103293"
  },
  "polishConvictions": {
    "title": "Polish Ministry of Justice — Adult convictions under the drug-control acts, 2002–2017 statistical series"
  },
  "polishPossession": {
    "title": "Polish possession-offence statistics, 2013–2018: detected offences and discontinued proceedings (compiled statistical series)"
  },
  "polishPoisonings": {
    "title": "Najwyższa Izba Kontroli — Przypadki zatruć i podejrzeń zatruć dopalaczami oraz wydatki na leczenie tych osób (2010–2016), with provisional 2017 data"
  },
  "cathinones": {
    "title": "Profil toksykologiczny i zależność struktura–aktywność nowych syntetycznych katynonów",
    "url": "https://doi.org/10.5604/01.3001.0013.9252"
  }
} satisfies Record<string, PublicationReference>;

export const SOURCE_REFERENCES: Readonly<Record<string, readonly PublicationReference[]>> = {
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p10, p18; Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p1": [{ ...PUBLICATIONS.p1, locator: "PDF p. 10, p18" }, { ...PUBLICATIONS.p53, locator: "PDF p. 1" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p10; Vogels et al 2009.pdf p3, p7": [{ ...PUBLICATIONS.p1, locator: "PDF p. 10" }, { ...PUBLICATIONS.p55, locator: "PDF p. 3, p7" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p11, p24": [{ ...PUBLICATIONS.p1, locator: "PDF p. 11, p24" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p11, p24; 2023_García_Chemsex from Drug Checking Services descriptive study on methamphetamine, mephedrone...pdf p3": [{ ...PUBLICATIONS.p1, locator: "PDF p. 11, p24" }, { ...PUBLICATIONS.p65, locator: "PDF p. 3" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p12; 2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p2": [{ ...PUBLICATIONS.p1, locator: "PDF p. 12" }, { ...PUBLICATIONS.p83, locator: "PDF p. 2" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p14 to p15": [{ ...PUBLICATIONS.p1, locator: "PDF p. 14 to p15" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p18; 2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p3": [{ ...PUBLICATIONS.p1, locator: "PDF p. 18" }, { ...PUBLICATIONS.p16, locator: "PDF p. 3" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p24 to p25; 2023_García_Chemsex from Drug Checking Services descriptive study on methamphetamine, mephedrone...pdf p3, p5; 2016_Caudevilla_Results of an international drug testing service for cryptomarket users.pdf p7": [{ ...PUBLICATIONS.p1, locator: "PDF p. 24 to p25" }, { ...PUBLICATIONS.p65, locator: "PDF p. 3, p5" }, { ...PUBLICATIONS.p7, locator: "PDF p. 7" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p24; 2001_EMCDDA_Pill_Testing_Summary.pdf p5": [{ ...PUBLICATIONS.p1, locator: "PDF p. 24" }, { ...PUBLICATIONS.p3, locator: "PDF p. 5" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p24; 2010_Calafat_Para qué sirve el testado de pastillas (Pill testing)...pdf p1 to p2; 2010_Vidal_Análisis in situ de sustancias y adulteraciones...pdf p1": [{ ...PUBLICATIONS.p1, locator: "PDF p. 24" }, { ...PUBLICATIONS.p56, locator: "PDF p. 1 to p2" }, { ...PUBLICATIONS.p57, locator: "PDF p. 1" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p24; 2016_Caudevilla_Results of an international drug testing service for cryptomarket users.pdf p7": [{ ...PUBLICATIONS.p1, locator: "PDF p. 24" }, { ...PUBLICATIONS.p7, locator: "PDF p. 7" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p25; 2016_Caudevilla_Results of an international drug testing service for cryptomarket users.pdf p7": [{ ...PUBLICATIONS.p1, locator: "PDF p. 25" }, { ...PUBLICATIONS.p7, locator: "PDF p. 7" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p34": [{ ...PUBLICATIONS.p1, locator: "PDF p. 34" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p34 to p35; 2022_Maghsoudi_The Implementation of Drug Checking Services for People Who Use Drugs A Systematic Review.pdf p20": [{ ...PUBLICATIONS.p1, locator: "PDF p. 34 to p35" }, { ...PUBLICATIONS.p25, locator: "PDF p. 20" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p35": [{ ...PUBLICATIONS.p1, locator: "PDF p. 35" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p36": [{ ...PUBLICATIONS.p1, locator: "PDF p. 36" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p4": [{ ...PUBLICATIONS.p1, locator: "PDF p. 4" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p4, p14": [{ ...PUBLICATIONS.p1, locator: "PDF p. 4, p14" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p4; 2001_EMCDDA_Pill_Testing_Report.pdf p36": [{ ...PUBLICATIONS.p1, locator: "PDF p. 4" }, { ...PUBLICATIONS.p2, locator: "PDF p. 36" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p5, p34": [{ ...PUBLICATIONS.p1, locator: "PDF p. 5, p34" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p5, p34; 2001_EMCDDA_Pill_Testing_Summary.pdf p6": [{ ...PUBLICATIONS.p1, locator: "PDF p. 5, p34" }, { ...PUBLICATIONS.p3, locator: "PDF p. 6" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p5; 2017_Chatwin_New drugs, new directions Research priorities for new psychoactive substances...pdf p2": [{ ...PUBLICATIONS.p1, locator: "PDF p. 5" }, { ...PUBLICATIONS.p10, locator: "PDF p. 2" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p7, p36": [{ ...PUBLICATIONS.p1, locator: "PDF p. 7, p36" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p7, p36; 2026_Tobias_Discordant Drug Checking Results and Risk Reduction Behaviours Findings From the ChecKnow Study in France.pdf p2": [{ ...PUBLICATIONS.p1, locator: "PDF p. 7, p36" }, { ...PUBLICATIONS.p51, locator: "PDF p. 2" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p8": [{ ...PUBLICATIONS.p1, locator: "PDF p. 8" }],
  "2001_EMCDDA_Pill_Testing_Fact_Files.pdf p9": [{ ...PUBLICATIONS.p1, locator: "PDF p. 9" }],
  "2004_NEIL_HUNT_harm reduction review.pdf p27": [{ ...PUBLICATIONS.p4, locator: "PDF p. 27" }],
  "2004_NEIL_HUNT_harm reduction review.pdf p27; 2018_Groves_Worth the test Pragmatism, pill testing and drug policy in Australia.pdf p5; 2024_Piatkowski_The compounds for females are really commonly faked...pdf p3": [{ ...PUBLICATIONS.p4, locator: "PDF p. 27" }, { ...PUBLICATIONS.p13, locator: "PDF p. 5" }, { ...PUBLICATIONS.p40, locator: "PDF p. 3" }],
  "2004_NEIL_HUNT_harm reduction review.pdf p27; 2022_Monti_Adulteration of low-delta-9-tetrahydrocannabinol products with synthetic cannabinoids...pdf p1": [{ ...PUBLICATIONS.p4, locator: "PDF p. 27" }, { ...PUBLICATIONS.p26, locator: "PDF p. 1" }],
  "2011_Hungerbuehler_Drug Checking A prevention measure for a heterogeneous group...pdf p1 to p2; 2023_Monti_Drug Checking Glimpse into the Recreational Drug Market in Switzerland.pdf p1; 2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p1 to p3": [{ ...PUBLICATIONS.p5, locator: "PDF p. 1 to p2" }, { ...PUBLICATIONS.p34, locator: "PDF p. 1" }, { ...PUBLICATIONS.p83, locator: "PDF p. 1 to p3" }],
  "2011_Hungerbuehler_Drug Checking A prevention measure for a heterogeneous group...pdf p2, p5; 2023_Monti_Drug Checking Glimpse into the Recreational Drug Market in Switzerland.pdf p1; 2022_Monti_Adulteration of low-delta-9-tetrahydrocannabinol products with synthetic cannabinoids...pdf p1; 2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p1": [{ ...PUBLICATIONS.p5, locator: "PDF p. 2, p5" }, { ...PUBLICATIONS.p34, locator: "PDF p. 1" }, { ...PUBLICATIONS.p26, locator: "PDF p. 1" }, { ...PUBLICATIONS.p83, locator: "PDF p. 1" }],
  "2016_Measham_What's So New About New Psychoactive Substances...pdf p9": [{ ...PUBLICATIONS.p8, locator: "PDF p. 9" }],
  "2016_Measham_What's So New About New Psychoactive Substances...pdf p9; 2024_Measham_Poppers, the Politics of Exemption and the Characteristics of Poppers Users...pdf p1, p4": [{ ...PUBLICATIONS.p8, locator: "PDF p. 9" }, { ...PUBLICATIONS.p39, locator: "PDF p. 1, p4" }],
  "2017_Barratt_Pill testing or drug checking in Australia Acceptability of service design features.pdf p7": [{ ...PUBLICATIONS.p9, locator: "PDF p. 7" }],
  "2017_Chatwin_New drugs, new directions Research priorities for new psychoactive substances...pdf p3": [{ ...PUBLICATIONS.p10, locator: "PDF p. 3" }],
  "2017_Giné_The utility of drug checking services as monitoring tools and more A response to Pirona et al.pdf p6 to p7; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p25": [{ ...PUBLICATIONS.p58, locator: "PDF p. 6 to p7" }, { ...PUBLICATIONS.p1, locator: "PDF p. 25" }],
  "2017_Martins_The detection and prevention of unintentional consumption of DOx and 25x-NBOMe at Portugal's Boom Festival.pdf p1 to p4; 2022_Valente_Drug use patterns, harm reduction strategies and use of drug checking services in boom festival patrons.pdf p4": [{ ...PUBLICATIONS.p11, locator: "PDF p. 1 to p4" }, { ...PUBLICATIONS.p28, locator: "PDF p. 4" }],
  "2017_Martins_The detection and prevention of unintentional consumption of DOx and 25x-NBOMe at Portugal's Boom Festival.pdf p1, p4 to p5": [{ ...PUBLICATIONS.p11, locator: "PDF p. 1, p4 to p5" }],
  "2018_Karamouzian_Evaluation of a fentanyl drug checking service for clients of a supervised injection facility, Vancouver...pdf p1, p4 to p5; 2025_Gozdzialski_A software framework for infrared spectral analysis in harm reduction drug checking.pdf p2; 2026_Tobias_Risk reduction behaviours following the detection of unexpected drugs through community drug checking...pdf p1": [{ ...PUBLICATIONS.p14, locator: "PDF p. 1, p4 to p5" }, { ...PUBLICATIONS.p77, locator: "PDF p. 2" }, { ...PUBLICATIONS.p93, locator: "PDF p. 1" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p2, p5; 2020_Guirguis_Piloting the UK's First Home-Office-Licensed Pharmacist-Led Drug Checking Service...pdf p5, p7, p11": [{ ...PUBLICATIONS.p16, locator: "PDF p. 2, p5" }, { ...PUBLICATIONS.p17, locator: "PDF p. 5, p7, p11" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p2, p6 to p9; 2022_MJ_The Cathinone Hydra Increased Cathinone and caffeine adulteration in the English MDMA market after Brexit...pdf p1": [{ ...PUBLICATIONS.p16, locator: "PDF p. 2, p6 to p9" }, { ...PUBLICATIONS.p24, locator: "PDF p. 1" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p2, p8": [{ ...PUBLICATIONS.p16, locator: "PDF p. 2, p8" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p3 to p4": [{ ...PUBLICATIONS.p16, locator: "PDF p. 3 to p4" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p3, p5 to p6, p8": [{ ...PUBLICATIONS.p16, locator: "PDF p. 3, p5 to p6, p8" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p3, p5; 2020_Guirguis_Piloting the UK's First Home-Office-Licensed Pharmacist-Led Drug Checking Service...pdf p1, p3; 2023_Mullin_Handheld Raman Spectroscopy in the First UK Home Office Licensed Pharmacist-Led Community Drug Checking Service.pdf p4": [{ ...PUBLICATIONS.p16, locator: "PDF p. 3, p5" }, { ...PUBLICATIONS.p17, locator: "PDF p. 1, p3" }, { ...PUBLICATIONS.p35, locator: "PDF p. 4" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p4 to p5; 2020_Guirguis_Piloting the UK's First Home-Office-Licensed Pharmacist-Led Drug Checking Service...pdf p3, p16; 2023_Mullin_Handheld Raman Spectroscopy in the First UK Home Office Licensed Pharmacist-Led Community Drug Checking Service.pdf p24": [{ ...PUBLICATIONS.p16, locator: "PDF p. 4 to p5" }, { ...PUBLICATIONS.p17, locator: "PDF p. 3, p16" }, { ...PUBLICATIONS.p35, locator: "PDF p. 24" }],
  "2019_Measham_Drug safety testing, disposals and dealing in an English field...pdf p5 to p6; 2020_Guirguis_Piloting the UK's First Home-Office-Licensed Pharmacist-Led Drug Checking Service...pdf p3, p5, p12": [{ ...PUBLICATIONS.p16, locator: "PDF p. 5 to p6" }, { ...PUBLICATIONS.p17, locator: "PDF p. 3, p5, p12" }],
  "2020_McAllister_The effect of public opinion and politics on attitudes towards pill testing...pdf p3; 2022_Olsen_Music festival drug checking Evaluation of an Australian pilot program.pdf p2, p8 to p9; 2024_Barratt_Adulteration and substitution of drugs purchased in Australia from cryptomarkets An analysis of Test4Pay.pdf p2; 2026_Usman_Understanding Consumption of Illicit Drugs and New Psychoactive Substances in Australia...pdf p2; 2024_Barratt_Adulteration and substitution of drugs purchased in Australia from cryptomarkets An analysis of Test4Pay.pdf p1": [{ ...PUBLICATIONS.p19, locator: "PDF p. 3" }, { ...PUBLICATIONS.p27, locator: "PDF p. 2, p8 to p9" }, { ...PUBLICATIONS.p38, locator: "PDF p. 2" }, { ...PUBLICATIONS.p52, locator: "PDF p. 2" }, { ...PUBLICATIONS.p38, locator: "PDF p. 1" }],
  "2020_McAllister_The effect of public opinion and politics on attitudes towards pill testing...pdf p3; 2025_Piatkowski_Psychological and socio-structural determinants of intentions to use drug checking services.pdf p3; 2026_Usman_Understanding Consumption of Illicit Drugs and New Psychoactive Substances in Australia...pdf p2": [{ ...PUBLICATIONS.p19, locator: "PDF p. 3" }, { ...PUBLICATIONS.p85, locator: "PDF p. 3" }, { ...PUBLICATIONS.p52, locator: "PDF p. 2" }],
  "2021_Hirschfeld_Safer Tripping Serotonergic Psychedelics and Drug Checking...pdf p5; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p34": [{ ...PUBLICATIONS.p21, locator: "PDF p. 5" }, { ...PUBLICATIONS.p1, locator: "PDF p. 34" }],
  "Kushakov et al. (2024), Harm Reduction Services for People who Use Psychoactive Substances in Recreational Contexts: Intervention Development and Implementation Guide, pp. 53-57": [{ ...PUBLICATIONS.drugstore2024, locator: "pp. 53-57" }],
  "2021_Hutton_Drug Checking at New Zealand Festivals (Final Report).pdf p38": [{ ...PUBLICATIONS.p60, locator: "PDF p. 38" }],
  "2021_Hutton_Drug Checking at New Zealand Festivals (Final Report).pdf p5, p25, p53": [{ ...PUBLICATIONS.p60, locator: "PDF p. 5, p25, p53" }],
  "2021_Hutton_Drug Checking at New Zealand Festivals (Final Report).pdf p59 to p60": [{ ...PUBLICATIONS.p60, locator: "PDF p. 59 to p60" }],
  "2021_Hutton_Drug Checking at New Zealand Festivals (Final Report).pdf p6, p31": [{ ...PUBLICATIONS.p60, locator: "PDF p. 6, p31" }],
  "2021_Hutton_Drug Checking at New Zealand Festivals (Final Report).pdf p6, p8 to p9; 2025_Kaskela_From trash to results shortcomings and benefits of paraphernalia-based drug checking in Finland.pdf p2": [{ ...PUBLICATIONS.p60, locator: "PDF p. 6, p8 to p9" }, { ...PUBLICATIONS.p80, locator: "PDF p. 2" }],
  "2021_Hutton_Drug Checking at New Zealand Festivals (Final Report).pdf p9, p53, p64": [{ ...PUBLICATIONS.p60, locator: "PDF p. 9, p53, p64" }],
  "2022_Friedman_The introduction of fentanyl on the US-Mexico border...pdf p9; 2004_NEIL_HUNT_harm reduction review.pdf p27": [{ ...PUBLICATIONS.p22, locator: "PDF p. 9" }, { ...PUBLICATIONS.p4, locator: "PDF p. 27" }],
  "2022_Larson_Police-led Fentanyl Test Strip Distribution Program in Maine and Massachusetts An Evaluation.pdf p2; 2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2; 2024_Reed_Recommendations from people who use drugs in Philadelphia, PA about structuring point-of-care drug checking.pdf p7": [{ ...PUBLICATIONS.p23, locator: "PDF p. 2" }, { ...PUBLICATIONS.p48, locator: "PDF p. 2" }, { ...PUBLICATIONS.p72, locator: "PDF p. 7" }],
  "2022_Olsen_Music festival drug checking Evaluation of an Australian pilot program.pdf p15; 2025_Puljević_It'd Be Nice to Know if You're About to Have Drain Cleaner...pdf p1; 2016_Australia_Pill-Testing-Report.pdf p13; 2018_Groves_Worth the test Pragmatism, pill testing and drug policy in Australia.pdf p4": [{ ...PUBLICATIONS.p27, locator: "PDF p. 15" }, { ...PUBLICATIONS.p86, locator: "PDF p. 1" }, { ...PUBLICATIONS.p6, locator: "PDF p. 13" }, { ...PUBLICATIONS.p13, locator: "PDF p. 4" }],
  "2022_Olsen_Music festival drug checking Evaluation of an Australian pilot program.pdf p3; 2023_Caldicott_A step change model analysis of the establishment of pill testing in one Australian jurisdiction.pdf p4; 2018_Grigg_Drug detection dogs at Australian outdoor music festivals Deterrent, detection and iatrogenic effects.pdf p4, p11 to p13; 2017_Barratt_Pill testing or drug checking in Australia Acceptability of service design features.pdf p5": [{ ...PUBLICATIONS.p27, locator: "PDF p. 3" }, { ...PUBLICATIONS.p63, locator: "PDF p. 4" }, { ...PUBLICATIONS.p12, locator: "PDF p. 4, p11 to p13" }, { ...PUBLICATIONS.p9, locator: "PDF p. 5" }],
  "2022_Olsen_Music festival drug checking Evaluation of an Australian pilot program.pdf p3; 2024_Barratt_Adulteration and substitution of drugs purchased in Australia from cryptomarkets An analysis of Test4Pay.pdf p2; 2025_Sutherland_Characteristics of take-home fentanyl test strip use and support for drug checking services...pdf p1; 2025_Piatkowski_Psychological and socio-structural determinants of intentions to use drug checking services.pdf p3": [{ ...PUBLICATIONS.p27, locator: "PDF p. 3" }, { ...PUBLICATIONS.p38, locator: "PDF p. 2" }, { ...PUBLICATIONS.p87, locator: "PDF p. 1" }, { ...PUBLICATIONS.p85, locator: "PDF p. 3" }],
  "2023_Caldicott_A step change model analysis of the establishment of pill testing in one Australian jurisdiction.pdf p1; 2022_Olsen_Music festival drug checking Evaluation of an Australian pilot program.pdf p3; 2026_Pocuca_Australian University Residential College Students' Awareness of and Attitudes Toward Drug Checking Services.pdf p2; 2026_Usman_Understanding Consumption of Illicit Drugs and New Psychoactive Substances in Australia...pdf p2; 2025_Keygan_Risk communication about high-dose MDMA Impact of a hypothetical drug alert on future MDMA use.pdf p11; 2020_McAllister_The effect of public opinion and politics on attitudes towards pill testing...pdf p3": [{ ...PUBLICATIONS.p63, locator: "PDF p. 1" }, { ...PUBLICATIONS.p27, locator: "PDF p. 3" }, { ...PUBLICATIONS.p91, locator: "PDF p. 2" }, { ...PUBLICATIONS.p52, locator: "PDF p. 2" }, { ...PUBLICATIONS.p44, locator: "PDF p. 11" }, { ...PUBLICATIONS.p19, locator: "PDF p. 3" }],
  "2023_Caluzzi_Who supports drug-checking services in Australia An analysis of 2019 National Drug Strategy Household Survey...pdf p3; 2020_McAllister_The effect of public opinion and politics on attitudes towards pill testing...pdf p1, p3, p11": [{ ...PUBLICATIONS.p31, locator: "PDF p. 3" }, { ...PUBLICATIONS.p19, locator: "PDF p. 1, p3, p11" }],
  "2023_Cruz_First drug-checking study at an electronic festival and fentanyl detection in the central region of Mexico.pdf p1": [{ ...PUBLICATIONS.p64, locator: "PDF p. 1" }],
  "2023_Cruz_First drug-checking study at an electronic festival and fentanyl detection in the central region of Mexico.pdf p1 to p2; 2025_Liddle_ToxiBot (Eleusis 3).pdf p1": [{ ...PUBLICATIONS.p64, locator: "PDF p. 1 to p2" }, { ...PUBLICATIONS.p45, locator: "PDF p. 1" }],
  "2023_Falzon_It would really support the wider harm reduction agenda A qualitative study of drug checking in Scotland.pdf p2": [{ ...PUBLICATIONS.p32, locator: "PDF p. 2" }],
  "2023_Falzon_Planning and implementing community-based drug checking services in Scotland a qualitative exploration.pdf p2": [{ ...PUBLICATIONS.p33, locator: "PDF p. 2" }],
  "2023_Grace_A qualitative assessment of key considerations for drug checking service implementation.pdf p4; 2025_Kirk_Using RE-AIM to evaluate the implementation of a social marketing and free product distribution project...pdf p1": [{ ...PUBLICATIONS.p66, locator: "PDF p. 4" }, { ...PUBLICATIONS.p81, locator: "PDF p. 1" }],
  "2023_Grace_A qualitative assessment of key considerations for drug checking service implementation.pdf p7; 2025_Airth_An implementation science study of a campus-based drug checking service at a Canadian university.pdf (file actually contains UNODC World Drug Report 2024 key findings) p74; 2022_Larson_Police-led Fentanyl Test Strip Distribution Program in Maine and Massachusetts An Evaluation.pdf p19; 2025_Murphy_Police Chiefs' Perspectives on Fentanyl Test Strips.pdf p2; 2026_Morris_Toward policy punctuation a content analysis of harm reduction framing in fentanyl test strip policy in texas.pdf p1; 2020_Mace_Decriminalize Drug-Checking Technologies in Pennsylvania to Prevent Overdose Deaths.pdf p1 to p2": [{ ...PUBLICATIONS.p66, locator: "PDF p. 7" }, { ...PUBLICATIONS.p74, locator: "PDF p. 74" }, { ...PUBLICATIONS.p23, locator: "PDF p. 19" }, { ...PUBLICATIONS.p84, locator: "PDF p. 2" }, { ...PUBLICATIONS.p90, locator: "PDF p. 1" }, { ...PUBLICATIONS.p18, locator: "PDF p. 1 to p2" }],
  "2023_Ondocsin_Insights from Drug Checking Programs Practicing Bootstrap Public Health...pdf p4; 2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2; 2025_Larson_Implementation of a Police-Led Fentanyl Test Strip Distribution Program in Two US States.pdf p2 to p3": [{ ...PUBLICATIONS.p36, locator: "PDF p. 4" }, { ...PUBLICATIONS.p48, locator: "PDF p. 2" }, { ...PUBLICATIONS.p82, locator: "PDF p. 2 to p3" }],
  "2023_Ondocsin_Insights from Drug Checking Programs Practicing Bootstrap Public Health...pdf p7; 2026_Morris_Toward policy punctuation a content analysis of harm reduction framing in fentanyl test strip policy in texas.pdf p1; 2025_Murphy_Police Chiefs' Perspectives on Fentanyl Test Strips.pdf p2": [{ ...PUBLICATIONS.p36, locator: "PDF p. 7" }, { ...PUBLICATIONS.p90, locator: "PDF p. 1" }, { ...PUBLICATIONS.p84, locator: "PDF p. 2" }],
  "2024_Algar_Identification of three unexpected new psychoactive substances at an Australian drug checking service.pdf p1 to p2; 2026_Usman_Understanding Consumption of Illicit Drugs and New Psychoactive Substances in Australia...pdf p2; 2025_Keygan_Risk communication about high-dose MDMA Impact of a hypothetical drug alert on future MDMA use.pdf p1": [{ ...PUBLICATIONS.p37, locator: "PDF p. 1 to p2" }, { ...PUBLICATIONS.p52, locator: "PDF p. 2" }, { ...PUBLICATIONS.p44, locator: "PDF p. 1" }],
  "2024_Coulaud_Implementation opportunities and challenges to piloting a community-based drug-checking intervention...pdf p9; 2020_Wallace_What is needed for implementing drug checking services in the context of the overdose crisis...pdf p5, p9": [{ ...PUBLICATIONS.p68, locator: "PDF p. 9" }, { ...PUBLICATIONS.p59, locator: "PDF p. 5, p9" }],
  "2024_De_Nitazene test strips a laboratory evaluation.pdf p3; 2021_Hirschfeld_Safer Tripping Serotonergic Psychedelics and Drug Checking...pdf p5; 2023_Balcaen_Challenges in Drug Surveillance Strengthening the Analysis of New Psychoactive Substances...pdf p1": [{ ...PUBLICATIONS.p69, locator: "PDF p. 3" }, { ...PUBLICATIONS.p21, locator: "PDF p. 5" }, { ...PUBLICATIONS.p30, locator: "PDF p. 1" }],
  "2024_Fabresse_Implementation of a community-based LC-UV drug checking service...pdf p3; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p37": [{ ...PUBLICATIONS.p70, locator: "PDF p. 3" }, { ...PUBLICATIONS.p1, locator: "PDF p. 37" }],
  "2024_Pires_City-level drug policies in Portugal the COVID-19 pandemic as an analyser...pdf p1, p3; 2025_Vale_City-level drug policies in Portugal the COVID-19 pandemic as an analyzer...pdf p1": [{ ...PUBLICATIONS.p41, locator: "PDF p. 1, p3" }, { ...PUBLICATIONS.p88, locator: "PDF p. 1" }],
  "2024_Valente_Responsibility, Care and Trust Among People Using Drug Checking Services at a Music Festival.pdf p4 to p5": [{ ...PUBLICATIONS.p42, locator: "PDF p. 4 to p5" }],
  "2024_Valente_Responsibility, Care and Trust Among People Using Drug Checking Services at a Music Festival.pdf p4; 2024_Pires_City-level drug policies in Portugal the COVID-19 pandemic as an analyser...pdf p3": [{ ...PUBLICATIONS.p42, locator: "PDF p. 4" }, { ...PUBLICATIONS.p41, locator: "PDF p. 3" }],
  "2024_Valente_Responsibility, Care and Trust Among People Using Drug Checking Services at a Music Festival.pdf p5; 2017_Martins_The detection and prevention of unintentional consumption of DOx and 25x-NBOMe at Portugal's Boom Festival.pdf p2": [{ ...PUBLICATIONS.p42, locator: "PDF p. 5" }, { ...PUBLICATIONS.p11, locator: "PDF p. 2" }],
  "2024_Valente_Responsibility, Care and Trust Among People Using Drug Checking Services at a Music Festival.pdf p5; 2024_Pires_City-level drug policies in Portugal the COVID-19 pandemic as an analyser...pdf p1; 2025_Vale_City-level drug policies in Portugal the COVID-19 pandemic as an analyzer...pdf p1": [{ ...PUBLICATIONS.p42, locator: "PDF p. 5" }, { ...PUBLICATIONS.p41, locator: "PDF p. 1" }, { ...PUBLICATIONS.p88, locator: "PDF p. 1" }],
  "2025_Bastien_Willingness to use a drug checking service for cannabis and cannabis-based products...pdf p1 to p2": [{ ...PUBLICATIONS.p75, locator: "PDF p. 1 to p2" }],
  "2025_Gomez_Community-based drug checking at syringe service programs in New York City...pdf p1; 2025_Berry_Impact of Lab-Based Drug Checking Services on Syringe Service Program Engagement in Maryland.pdf p1; 2022_Larson_Police-led Fentanyl Test Strip Distribution Program in Maine and Massachusetts An Evaluation.pdf p2": [{ ...PUBLICATIONS.p76, locator: "PDF p. 1" }, { ...PUBLICATIONS.p43, locator: "PDF p. 1" }, { ...PUBLICATIONS.p23, locator: "PDF p. 2" }],
  "2025_Gozdzialski_A software framework for infrared spectral analysis in harm reduction drug checking.pdf p2": [{ ...PUBLICATIONS.p77, locator: "PDF p. 2" }],
  "2025_Karden_Utilization of drug checking services in Austria a cross-sectional online survey.pdf p1, p8; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p15; 2016_Australia_Pill-Testing-Report.pdf p22; 2018_Groves_Worth the test Pragmatism, pill testing and drug policy in Australia.pdf p8": [{ ...PUBLICATIONS.p79, locator: "PDF p. 1, p8" }, { ...PUBLICATIONS.p1, locator: "PDF p. 15" }, { ...PUBLICATIONS.p6, locator: "PDF p. 22" }, { ...PUBLICATIONS.p13, locator: "PDF p. 8" }],
  "2025_Karden_Utilization of drug checking services in Austria a cross-sectional online survey.pdf p2": [{ ...PUBLICATIONS.p79, locator: "PDF p. 2" }],
  "2025_Karden_Utilization of drug checking services in Austria a cross-sectional online survey.pdf p3, p9; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p14": [{ ...PUBLICATIONS.p79, locator: "PDF p. 3, p9" }, { ...PUBLICATIONS.p1, locator: "PDF p. 14" }],
  "2025_Karden_Utilization of drug checking services in Austria a cross-sectional online survey.pdf p9; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p15": [{ ...PUBLICATIONS.p79, locator: "PDF p. 9" }, { ...PUBLICATIONS.p1, locator: "PDF p. 15" }],
  "2025_Kaskela_From trash to results shortcomings and benefits of paraphernalia-based drug checking in Finland.pdf p1, p3 to p4": [{ ...PUBLICATIONS.p80, locator: "PDF p. 1, p3 to p4" }],
  "2025_Kaskela_From trash to results shortcomings and benefits of paraphernalia-based drug checking in Finland.pdf p1, p5": [{ ...PUBLICATIONS.p80, locator: "PDF p. 1, p5" }],
  "2025_Kaskela_From trash to results shortcomings and benefits of paraphernalia-based drug checking in Finland.pdf p10": [{ ...PUBLICATIONS.p80, locator: "PDF p. 10" }],
  "2025_Kaskela_From trash to results shortcomings and benefits of paraphernalia-based drug checking in Finland.pdf p2 to p3": [{ ...PUBLICATIONS.p80, locator: "PDF p. 2 to p3" }],
  "2025_Kaskela_From trash to results shortcomings and benefits of paraphernalia-based drug checking in Finland.pdf p3": [{ ...PUBLICATIONS.p80, locator: "PDF p. 3" }],
  "2025_Liddle_ToxiBot (Eleusis 3).pdf p1": [{ ...PUBLICATIONS.p45, locator: "PDF p. 1" }],
  "2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p2 to p3; 2023_Monti_Drug Checking Glimpse into the Recreational Drug Market in Switzerland.pdf p1; 2011_Hungerbuehler_Drug Checking A prevention measure for a heterogeneous group...pdf p2": [{ ...PUBLICATIONS.p83, locator: "PDF p. 2 to p3" }, { ...PUBLICATIONS.p34, locator: "PDF p. 1" }, { ...PUBLICATIONS.p5, locator: "PDF p. 2" }],
  "2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p2; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p12": [{ ...PUBLICATIONS.p83, locator: "PDF p. 2" }, { ...PUBLICATIONS.p1, locator: "PDF p. 12" }],
  "2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p2; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p12, p16": [{ ...PUBLICATIONS.p83, locator: "PDF p. 2" }, { ...PUBLICATIONS.p1, locator: "PDF p. 12, p16" }],
  "2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p2; 2023_Monti_Drug Checking Glimpse into the Recreational Drug Market in Switzerland.pdf p1; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p12, p16": [{ ...PUBLICATIONS.p83, locator: "PDF p. 2" }, { ...PUBLICATIONS.p34, locator: "PDF p. 1" }, { ...PUBLICATIONS.p1, locator: "PDF p. 12, p16" }],
  "2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids in Switzerland...pdf p2; 2023_Monti_Drug Checking Glimpse into the Recreational Drug Market in Switzerland.pdf p1; Cannabis-adulterated-with-the-synthetic-cannabinoid-rec_2022_International-J.pdf p2": [{ ...PUBLICATIONS.p83, locator: "PDF p. 2" }, { ...PUBLICATIONS.p34, locator: "PDF p. 1" }, { ...PUBLICATIONS.p54, locator: "PDF p. 2" }],
  "2025_Singh_Probing trends of opioid seizures and drug checking samples under a nascent decriminalization framework in Vancouver...pdf p2; 2025_Hutchison_Implementing community drug checking in smaller urban communities...pdf p1, p5": [{ ...PUBLICATIONS.p47, locator: "PDF p. 2" }, { ...PUBLICATIONS.p78, locator: "PDF p. 1, p5" }],
  "2025_Singh_Probing trends of opioid seizures and drug checking samples under a nascent decriminalization framework in Vancouver...pdf p2; 2026_CDA-AMC_Drug-Checking Technologies to Detect Compositions of Unregulated Substance Samples.pdf p45": [{ ...PUBLICATIONS.p47, locator: "PDF p. 2" }, { ...PUBLICATIONS.p89, locator: "PDF p. 45" }],
  "2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2": [{ ...PUBLICATIONS.p48, locator: "PDF p. 2" }],
  "2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2, p7 to p8": [{ ...PUBLICATIONS.p48, locator: "PDF p. 2, p7 to p8" }],
  "2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2; 2022_Carroll_The Bronze Age of drug checking barriers and facilitators to implementing advanced drug checking...pdf p4; 2023_Grace_A qualitative assessment of key considerations for drug checking service implementation.pdf p4 to p5": [{ ...PUBLICATIONS.p48, locator: "PDF p. 2" }, { ...PUBLICATIONS.p61, locator: "PDF p. 4" }, { ...PUBLICATIONS.p66, locator: "PDF p. 4 to p5" }],
  "2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2; 2023_Cruz_First drug-checking study at an electronic festival and fentanyl detection in the central region of Mexico.pdf p2": [{ ...PUBLICATIONS.p48, locator: "PDF p. 2" }, { ...PUBLICATIONS.p64, locator: "PDF p. 2" }],
  "2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p2; 2025_Liddle_ToxiBot (Eleusis 3).pdf p1 to p2": [{ ...PUBLICATIONS.p48, locator: "PDF p. 2" }, { ...PUBLICATIONS.p45, locator: "PDF p. 1 to p2" }],
  "2026_Bird_Drug Checking Services in Latin America vs. the United States...pdf p7 to p8; 2025_Gomez_Community-based drug checking at syringe service programs in New York City...pdf p1; 2025_Berry_Impact of Lab-Based Drug Checking Services on Syringe Service Program Engagement in Maryland.pdf p1; 2026_Summers_Real time, on-site drug checking in low-threshold housing communities.pdf p3": [{ ...PUBLICATIONS.p48, locator: "PDF p. 7 to p8" }, { ...PUBLICATIONS.p76, locator: "PDF p. 1" }, { ...PUBLICATIONS.p43, locator: "PDF p. 1" }, { ...PUBLICATIONS.p92, locator: "PDF p. 3" }],
  "2026_CDA-AMC_Drug-Checking Technologies to Detect Compositions of Unregulated Substance Samples.pdf p14; 2018_Karamouzian_Evaluation of a fentanyl drug checking service for clients of a supervised injection facility, Vancouver...pdf p3; 2021_Borden_A new quantitative drug checking technology for harm reduction Pilot study in Vancouver...pdf p2": [{ ...PUBLICATIONS.p89, locator: "PDF p. 14" }, { ...PUBLICATIONS.p14, locator: "PDF p. 3" }, { ...PUBLICATIONS.p20, locator: "PDF p. 2" }],
  "2026_CDA-AMC_Drug-Checking Technologies to Detect Compositions of Unregulated Substance Samples.pdf p14; 2018_Karamouzian_Evaluation of a fentanyl drug checking service for clients of a supervised injection facility, Vancouver...pdf p3; 2025_Gozdzialski_A software framework for infrared spectral analysis in harm reduction drug checking.pdf p2; 2026_Gonzalez-Nieto_Drug sellers' use of a drug checking service amid the overdose crisis in British Columbia, Canada.pdf p1": [{ ...PUBLICATIONS.p89, locator: "PDF p. 14" }, { ...PUBLICATIONS.p14, locator: "PDF p. 3" }, { ...PUBLICATIONS.p77, locator: "PDF p. 2" }, { ...PUBLICATIONS.p49, locator: "PDF p. 1" }],
  "2026_Gonzalez-Nieto_Drug sellers' use of a drug checking service amid the overdose crisis in British Columbia, Canada.pdf p1; 2026_CDA-AMC_Drug-Checking Technologies to Detect Compositions of Unregulated Substance Samples.pdf p14": [{ ...PUBLICATIONS.p49, locator: "PDF p. 1" }, { ...PUBLICATIONS.p89, locator: "PDF p. 14" }],
  "2026_Gonzalez-Nieto_Drug sellers' use of a drug checking service amid the overdose crisis in British Columbia, Canada.pdf p1; 2026_CDA-AMC_Drug-Checking Technologies to Detect Compositions of Unregulated Substance Samples.pdf p45": [{ ...PUBLICATIONS.p49, locator: "PDF p. 1" }, { ...PUBLICATIONS.p89, locator: "PDF p. 45" }],
  "2026_Silcox_Source Matters An Examination of Drug Checking Samples from Police Departments and Community Based Programs...pdf p1; 2025_Gomez_Community-based drug checking at syringe service programs in New York City...pdf p1": [{ ...PUBLICATIONS.p50, locator: "PDF p. 1" }, { ...PUBLICATIONS.p76, locator: "PDF p. 1" }],
  "2026_Tobias_Discordant Drug Checking Results and Risk Reduction Behaviours Findings From the ChecKnow Study in France.pdf p1; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p36": [{ ...PUBLICATIONS.p51, locator: "PDF p. 1" }, { ...PUBLICATIONS.p1, locator: "PDF p. 36" }],
  "2026_Tobias_Discordant Drug Checking Results and Risk Reduction Behaviours Findings From the ChecKnow Study in France.pdf p2; 2024_Fabresse_Implementation of a community-based LC-UV drug checking service...pdf p2 to p3": [{ ...PUBLICATIONS.p51, locator: "PDF p. 2" }, { ...PUBLICATIONS.p70, locator: "PDF p. 2 to p3" }],
  "2026_Tobias_Discordant Drug Checking Results and Risk Reduction Behaviours Findings From the ChecKnow Study in France.pdf p2; 2025_Bastien_Willingness to use a drug checking service for cannabis and cannabis-based products...pdf p1": [{ ...PUBLICATIONS.p51, locator: "PDF p. 2" }, { ...PUBLICATIONS.p75, locator: "PDF p. 1" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p2 to p3": [{ ...PUBLICATIONS.p94, locator: "PDF p. 2 to p3" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p2 to p4; 2018_Sande_The importance of drug checking outside the context of nightlife in Slovenia.pdf p5": [{ ...PUBLICATIONS.p94, locator: "PDF p. 2 to p4" }, { ...PUBLICATIONS.p15, locator: "PDF p. 5" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p2, p4 to p5, p7; 2024_Verdenik_I will not use it because the results are bad...pdf p2, p5, p7": [{ ...PUBLICATIONS.p94, locator: "PDF p. 2, p4 to p5, p7" }, { ...PUBLICATIONS.p73, locator: "PDF p. 2, p5, p7" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p3": [{ ...PUBLICATIONS.p94, locator: "PDF p. 3" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p3 to p4": [{ ...PUBLICATIONS.p94, locator: "PDF p. 3 to p4" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p3 to p4; 2018_Sande_The importance of drug checking outside the context of nightlife in Slovenia.pdf p1 to p2, p6": [{ ...PUBLICATIONS.p94, locator: "PDF p. 3 to p4" }, { ...PUBLICATIONS.p15, locator: "PDF p. 1 to p2, p6" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p3; 2018_Sande_The importance of drug checking outside the context of nightlife in Slovenia.pdf p2": [{ ...PUBLICATIONS.p94, locator: "PDF p. 3" }, { ...PUBLICATIONS.p15, locator: "PDF p. 2" }],
  "2026_Verdenik_I want to know what I'm taking, long-term evaluation of the drug checking service in Slovenia...pdf p3; 2024_Verdenik_I will not use it because the results are bad...pdf p2; 2018_Sande_The importance of drug checking outside the context of nightlife in Slovenia.pdf p5": [{ ...PUBLICATIONS.p94, locator: "PDF p. 3" }, { ...PUBLICATIONS.p73, locator: "PDF p. 2" }, { ...PUBLICATIONS.p15, locator: "PDF p. 5" }],
  "Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p1": [{ ...PUBLICATIONS.p53, locator: "PDF p. 1" }],
  "Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p1; 2004_NEIL_HUNT_harm reduction review.pdf p27, p28 to p29": [{ ...PUBLICATIONS.p53, locator: "PDF p. 1" }, { ...PUBLICATIONS.p4, locator: "PDF p. 27, p28 to p29" }],
  "Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p2, p5, p8; Vogels et al 2009.pdf p8 to p9": [{ ...PUBLICATIONS.p53, locator: "PDF p. 2, p5, p8" }, { ...PUBLICATIONS.p55, locator: "PDF p. 8 to p9" }],
  "Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p3; RPJ_Koning_Dutch_drug_checking_system_AAM.docx Introduction section; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p19": [{ ...PUBLICATIONS.p53, locator: "PDF p. 3" }, { ...PUBLICATIONS.koning, locator: "Introduction (accepted manuscript; unpaginated)" }, { ...PUBLICATIONS.p1, locator: "PDF p. 19" }],
  "HR Drug Checking/2001_EMCDDA_Pill_Testing_Fact_Files": [{ ...PUBLICATIONS.p1 }],
  "HR Drug Checking/2004_NEIL_HUNT_harm reduction review": [{ ...PUBLICATIONS.p4 }],
  "HR Drug Checking/2017_Barratt_Pill testing or drug checking in Australia Acceptability of service design features p5, p10": [{ ...PUBLICATIONS.p9, locator: "PDF p. 5, p10" }],
  "HR Drug Checking/2017_Barratt_Pill testing or drug checking in Australia p5, p10": [{ ...PUBLICATIONS.p9, locator: "PDF p. 5, p10" }],
  "HR Drug Checking/2018_Karamouzian_Evaluation of a fentanyl drug checking service p3": [{ ...PUBLICATIONS.p14, locator: "PDF p. 3" }],
  "HR Drug Checking/2019_Measham_Drug safety testing p2, p4, p7, p10": [{ ...PUBLICATIONS.p16, locator: "PDF p. 2, p4, p7, p10" }],
  "HR Drug Checking/2020_McAllister": [{ ...PUBLICATIONS.p19 }],
  "HR Drug Checking/2021_Hutton": [{ ...PUBLICATIONS.p60 }],
  "HR Drug Checking/2022_Carroll_The Bronze Age of drug checking p1, p4-5": [{ ...PUBLICATIONS.p61, locator: "PDF p. 1, p4-5" }],
  "HR Drug Checking/2022_Davis_Substance Use Stigma and Community Drug Checking p1": [{ ...PUBLICATIONS.p62, locator: "PDF p. 1" }],
  "HR Drug Checking/2022_Olsen_Music festival drug checking": [{ ...PUBLICATIONS.p27 }],
  "HR Drug Checking/2022_Wallace_Implementing drug checking as an illicit drug market intervention p1": [{ ...PUBLICATIONS.p29, locator: "PDF p. 1" }],
  "HR Drug Checking/2023_Caldicott_A step change model analysis p1, p3-4": [{ ...PUBLICATIONS.p63, locator: "PDF p. 1, p3-4" }],
  "HR Drug Checking/2023_Caluzzi": [{ ...PUBLICATIONS.p31 }],
  "HR Drug Checking/2023_Falzon_Planning and implementing community-based drug checking services in Scotland p2": [{ ...PUBLICATIONS.p33, locator: "PDF p. 2" }],
  "HR Drug Checking/2023_Grace_Contextual factors affecting the implementation of drug checking p1, p3": [{ ...PUBLICATIONS.p67, locator: "PDF p. 1, p3" }],
  "HR Drug Checking/2023_Grace_Contextual factors p5": [{ ...PUBLICATIONS.p67, locator: "PDF p. 5" }],
  "HR Drug Checking/2023_Mullin_Handheld Raman Spectroscopy p1": [{ ...PUBLICATIONS.p35, locator: "PDF p. 1" }],
  "HR Drug Checking/2023_Ondocsin_Insights from Drug Checking Programs p4, p7": [{ ...PUBLICATIONS.p36, locator: "PDF p. 4, p7" }],
  "HR Drug Checking/2024_Barratt_Adulteration and substitution of drugs purchased in Australia from cryptomarkets p1": [{ ...PUBLICATIONS.p38, locator: "PDF p. 1" }],
  "HR Drug Checking/2024_Coulaud_Implementation opportunities and challenges p5, p9": [{ ...PUBLICATIONS.p68, locator: "PDF p. 5, p9" }],
  "HR Drug Checking/2024_Moon_Enhancing drug checking services for supply monitoring p5, p7": [{ ...PUBLICATIONS.p71, locator: "PDF p. 5, p7" }],
  "HR Drug Checking/2024_Pires_City-level drug policies in Portugal p1": [{ ...PUBLICATIONS.p41, locator: "PDF p. 1" }],
  "HR Drug Checking/2024_Reed_Recommendations from people who use drugs in Philadelphia p7": [{ ...PUBLICATIONS.p72, locator: "PDF p. 7" }],
  "HR Drug Checking/2024_Verdenik_I will not use it because the results are bad": [{ ...PUBLICATIONS.p73 }],
  "HR Drug Checking/2025_Berry_Impact of Lab-Based Drug Checking Services on Syringe Service Program Engagement p1-2": [{ ...PUBLICATIONS.p43, locator: "PDF p. 1-2" }],
  "HR Drug Checking/2025_Hutchison": [{ ...PUBLICATIONS.p78 }],
  "HR Drug Checking/2025_Karden_Utilization of drug checking services in Austria p4": [{ ...PUBLICATIONS.p79, locator: "PDF p. 4" }],
  "HR Drug Checking/2025_Kaskela_From trash to results p1, p3": [{ ...PUBLICATIONS.p80, locator: "PDF p. 1, p3" }],
  "HR Drug Checking/2025_Keygan_Risk communication about high-dose MDMA p1": [{ ...PUBLICATIONS.p44, locator: "PDF p. 1" }],
  "HR Drug Checking/2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids p3-4, p7": [{ ...PUBLICATIONS.p83, locator: "PDF p. 3-4, p7" }],
  "HR Drug Checking/2025_Pocuca_Understanding Drug and Alcohol Staff Perspectives p1": [{ ...PUBLICATIONS.p46, locator: "PDF p. 1" }],
  "HR Drug Checking/2025_Puljević_It'd Be Nice to Know p5": [{ ...PUBLICATIONS.p86, locator: "PDF p. 5" }],
  "HR Drug Checking/2025_Singh_Probing trends of opioid seizures p1": [{ ...PUBLICATIONS.p47, locator: "PDF p. 1" }],
  "HR Drug Checking/2026_Bird_Drug Checking Services in Latin America vs. the United States p1": [{ ...PUBLICATIONS.p48, locator: "PDF p. 1" }],
  "HR Drug Checking/2026_Silcox_Source Matters p1": [{ ...PUBLICATIONS.p50, locator: "PDF p. 1" }],
  "HR Drug Checking/2026_Summers_Real time, on-site drug checking p3, p5": [{ ...PUBLICATIONS.p92, locator: "PDF p. 3, p5" }],
  "HR Drug Checking/2026_Verdenik_I want to know what I'm taking": [{ ...PUBLICATIONS.p94 }],
  "HR Drug Checking/Brunt_2011b drug  information monitoring system in the netherlands DIMS p1": [{ ...PUBLICATIONS.p53, locator: "PDF p. 1" }],
  "HR Drug Checking/Brunt_2011b drug  information monitoring system in the netherlands DIMS p2, p5, p8": [{ ...PUBLICATIONS.p53, locator: "PDF p. 2, p5, p8" }],
  "RPJ_Koning_Dutch_drug_checking_system_AAM.docx Introduction section (docx, unpaginated); Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p2; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p10, p18 to p19": [{ ...PUBLICATIONS.koning, locator: "Introduction (accepted manuscript; unpaginated)" }, { ...PUBLICATIONS.p53, locator: "PDF p. 2" }, { ...PUBLICATIONS.p1, locator: "PDF p. 10, p18 to p19" }],
  "RPJ_Koning_Dutch_drug_checking_system_AAM.docx Introduction section; Brunt_2011b drug  information monitoring system in the netherlands DIMS.pdf p1; Vogels et al 2009.pdf p1, p8 to p9; 2001_EMCDDA_Pill_Testing_Fact_Files.pdf p18; 2016_Australia_Pill-Testing-Report.pdf p25; 2021_Hirschfeld_Safer Tripping Serotonergic Psychedelics and Drug Checking...pdf p3": [{ ...PUBLICATIONS.koning, locator: "Introduction (accepted manuscript; unpaginated)" }, { ...PUBLICATIONS.p53, locator: "PDF p. 1" }, { ...PUBLICATIONS.p55, locator: "PDF p. 1, p8 to p9" }, { ...PUBLICATIONS.p1, locator: "PDF p. 18" }, { ...PUBLICATIONS.p6, locator: "PDF p. 25" }, { ...PUBLICATIONS.p21, locator: "PDF p. 3" }],
  "Wiedza/_polskie/zawilska-nsp-dopalacze.pdf (outside HR Drug Checking folder) p10": [{ ...PUBLICATIONS.cathinones, locator: "PDF p. 10" }],
  "Wiedza/narkopolityka/2013 - 2018 wybrane art.xlsx (outside HR Drug Checking folder) sheet wykryte row 43": [{ ...PUBLICATIONS.polishPossession, locator: "sheet detected offences row 43" }],
  "Wiedza/narkopolityka/2013 - 2018 wybrane art.xlsx (outside HR Drug Checking folder) sheets umorzone rows 24 to 110, wykryte row 43; Wiedza/narkopolityka/stare_082_30_2018 informacja w zakresie ustaw o przewdział. narkomani.xlsx (outside HR Drug Checking folder) sheet 2002-2017 rows 90, 115 to 117; Wiedza/_polskie/zawilska-nsp-dopalacze.pdf (outside HR Drug Checking folder) p10": [{ ...PUBLICATIONS.polishPossession, locator: "sheets discontinued proceedings rows 24 to 110, detected offences row 43" }, { ...PUBLICATIONS.polishConvictions, locator: "sheet 2002-2017 rows 90, 115 to 117" }, { ...PUBLICATIONS.cathinones, locator: "PDF p. 10" }],
  "Wiedza/narkopolityka/zatrucia.png (outside HR Drug Checking folder) chart": [{ ...PUBLICATIONS.polishPoisonings, locator: "Chart" }],
  "narkopolityka/2013 - 2018 wybrane art.xlsx (wykryte)": [{ ...PUBLICATIONS.polishPossession, locator: "Detected offences series" }],
  "narkopolityka/stare_082_30_2018 (sheet 2002-2017)": [{ ...PUBLICATIONS.polishConvictions, locator: "sheet 2002-2017)" }],
};
