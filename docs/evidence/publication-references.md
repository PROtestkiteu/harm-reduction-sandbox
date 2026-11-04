# Publication references in evidence panels

`src/config/publicationReferences.ts` maps original citation locators to publication titles, DOI or publisher URLs where verified, and the cited page or section. The original `Citation.source` remains unchanged as an internal provenance key. The UI never prints it.

Metadata was checked on 4 November 2026 against the research-library documents, DOI registry records, and primary publisher/institution pages. Generic PDF metadata and filenames were not accepted as publication titles. Where a public URL was not verified, the identified publication or statistical series remains an unlinked reference. Links are bundled metadata; the app makes no citation-lookup requests.

Important identity checks:

- Calafat's 2010 letter has DOI `10.20882/adicciones.206`. A DOI in its reference list identifies a different paper and must not be used for the letter.
- The library item labelled as Airth's 2025 campus paper actually contains **UNODC, World Drug Report 2024: Key Findings and Conclusions**. Its displayed reference identifies the report actually used.
- The item labelled `zawilska-nsp-dopalacze` contains Wronikowska and Budzyńska's **Profil toksykologiczny i zależność struktura–aktywność nowych syntetycznych katynonów**, DOI `10.5604/01.3001.0013.9252`.
- Page locators are PDF-page indices of the library copy; accepted manuscripts and preprints may have different pagination from the version of record. Unpaginated manuscript sections are identified explicitly.
- The Polish poisoning chart is a NIK compilation using GIS, clinical-toxicology consultant and NFZ data. Conviction and possession-offence series remain identified as statistical sources rather than journal papers.
- Explicit evidence gaps remain gaps and are not counted as supporting publications.

Run `node scripts/tests/citationReferences.mjs` when changing citation metadata. It checks coverage of all existing factor and preset citations, multiple-source preservation, source identity and the absence of private filenames from displayed reference fields.
