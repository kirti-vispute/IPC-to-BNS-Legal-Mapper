import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const casesPath = resolve(root, "evaluation/cases/candidate-cases.jsonl");
const statutesPath = resolve(root, "backend/data/statutes.json");
const manifestPath = resolve(root, "legal-sources/manifest.json");
const outputPath = resolve(root, "evaluation/official-source-reference-evaluation/official-source-reference-labels.json");

// Independence boundary: this builder reads only unlabeled cases and provenance-backed legal sources.
const caseText = await readFile(casesPath, "utf8");
const statuteText = await readFile(statutesPath, "utf8");
const manifestText = await readFile(manifestPath, "utf8");
const cases = parseJsonLines(caseText);
const statutes = JSON.parse(statuteText);
const manifest = JSON.parse(manifestText);
const casesById = new Map(cases.map((item) => [item.caseId, item]));
const statutesById = new Map(statutes.map((item) => [item.id.toLowerCase(), item]));

const commencement = {
  document: "BNS Commencement Notification S.O. 850(E)",
  authority: "Gazette of India, Ministry of Home Affairs",
  file: "bns-commencement-gazette-2024.pdf",
  pdfPage: 2,
  section: "Notification S.O. 850(E)",
  sha256: "dfcd5df23fb711f2996959b13ee6ff6bd32ed38be1e1f2d1c820cbba86e2a8c9",
  support: "Appoints 1 July 2024 as the commencement date for BNS, except BNS section 106(2).",
};

const decisions = [
  {
    caseId: "blind-001",
    factsNeedingReference: ["date of alleged conduct", "dishonest intention", "movable property", "movement from another person's possession", "absence of consent"],
    applicableLaw: "IPC_ONLY",
    referenceTop1: provision("IPC", "378", "Theft"),
    acceptable: [provision("IPC", "378", "Theft"), provision("IPC", "379", "Punishment for theft")],
    sources: [source("ipc-378", "Section 378 states the defining elements reflected in the case facts."), source("ipc-379", "Section 379 supplies the general punishment for theft."), source("bns-358", "The repeal-and-savings clause preserves liabilities and proceedings for offences committed under the repealed IPC."), commencement],
    justification: "The alleged conduct predates BNS commencement. The stated elements track IPC section 378 directly; section 379 is an acceptable associated punishment provision.",
    requiresExpertReview: false,
    expertReviewReason: null,
    eligibility: eligibleAll(),
  },
  {
    caseId: "blind-002",
    factsNeedingReference: ["date of alleged conduct", "dishonest intention", "movable property", "taking from another person's possession", "absence of consent"],
    applicableLaw: "BNS_PRIMARY",
    referenceTop1: provision("BNS", "303", "Theft"),
    acceptable: [provision("BNS", "303", "Theft")],
    sources: [source("bns-303", "Section 303 contains both the definition and general punishment for theft."), commencement],
    justification: "The alleged conduct is after BNS commencement, and the stated elements track BNS section 303(1).",
    requiresExpertReview: false,
    expertReviewReason: null,
    eligibility: eligibleAll(),
  },
  {
    caseId: "blind-003",
    factsNeedingReference: ["date of alleged conduct", "causation of death", "intention", "circumstances relevant to murder clauses and exceptions"],
    applicableLaw: "IPC_ONLY",
    referenceTop1: null,
    acceptable: [provision("IPC", "299", "Culpable homicide"), provision("IPC", "300", "Murder")],
    sources: [source("ipc-299", "Section 299 covers causing death with intention to cause death."), source("ipc-300", "Section 300 distinguishes murder and contains fact-dependent exceptions."), source("bns-358", "The repeal-and-savings clause preserves IPC liability for pre-commencement conduct."), commencement],
    justification: "The date fixes the IPC framework, but the short facts do not address the circumstances and exceptions needed to choose uniquely between IPC sections 299 and 300.",
    requiresExpertReview: true,
    expertReviewReason: "A unique homicide provision requires additional facts or expert legal characterization.",
    eligibility: routeOnly(),
  },
  {
    caseId: "blind-004",
    factsNeedingReference: ["date of alleged conduct", "deception", "dishonest inducement", "delivery of property"],
    applicableLaw: "BNS_PRIMARY",
    referenceTop1: provision("BNS", "318", "Cheating"),
    acceptable: [provision("BNS", "318", "Cheating")],
    sources: [source("bns-318", "Section 318(1) defines cheating and section 318(4) addresses dishonest inducement to deliver property."), commencement],
    justification: "The alleged conduct is after BNS commencement. BNS section 318(1) and (4) directly address deception followed by dishonest inducement to deliver property.",
    requiresExpertReview: false,
    expertReviewReason: null,
    eligibility: eligibleAll(),
  },
  {
    caseId: "blind-005",
    factsNeedingReference: ["start and end dates", "whether the conduct is legally continuing", "when the offence was completed", "deception", "dishonest inducement", "delivery of property"],
    applicableLaw: "MULTI_PERIOD_REVIEW",
    referenceTop1: null,
    acceptable: [provision("IPC", "415", "Cheating"), provision("IPC", "420", "Cheating and dishonestly inducing delivery of property"), provision("BNS", "318", "Cheating")],
    sources: [source("ipc-415", "Section 415 defines cheating under IPC."), source("ipc-420", "Section 420 addresses cheating that dishonestly induces delivery of property."), source("bns-318", "Section 318 contains the BNS cheating provisions."), source("bns-358", "The repeal-and-savings clause preserves pre-commencement IPC liabilities."), commencement],
    justification: "The stated period crosses BNS commencement. Both IPC and BNS cheating provisions are textually relevant, but the authoritative texts alone do not determine offence completion or charging treatment for this fact pattern.",
    requiresExpertReview: true,
    expertReviewReason: "The cross-commencement treatment and unique Top-1 provision require expert analysis of the alleged continuing conduct.",
    eligibility: routeOnly(),
  },
  {
    caseId: "blind-006",
    factsNeedingReference: ["date or period of alleged conduct", "deception", "dishonest inducement", "delivery of property"],
    applicableLaw: "CLARIFY",
    referenceTop1: null,
    acceptable: [],
    sources: [source("ipc-420", "Section 420 is a potentially relevant pre-commencement provision."), source("bns-318", "Section 318 is a potentially relevant post-commencement provision."), source("bns-358", "The repeal-and-savings clause makes timing material to the governing framework."), commencement],
    justification: "The facts omit the date, so the official commencement and savings materials do not permit selection of IPC or BNS. A date clarification is required before ranking a provision.",
    requiresExpertReview: true,
    expertReviewReason: "The occurrence date is a legally material missing fact.",
    eligibility: routeOnly(),
  },
  {
    caseId: "blind-007",
    factsNeedingReference: ["date of alleged conduct", "organised crime syndicate", "continuing unlawful activity", "serious predicate offences", "remaining statutory elements"],
    applicableLaw: "BNS_PRIMARY",
    referenceTop1: provision("BNS", "111", "Organised crime"),
    acceptable: [provision("BNS", "111", "Organised crime")],
    sources: [source("bns-111", "Section 111 defines organised crime, organised crime syndicate, and continuing unlawful activity."), commencement],
    justification: "The case is post-commencement and expressly invokes an organised crime syndicate and continuing unlawful activity, making BNS section 111 the objective retrieval target. Whether every offence element is proved is outside this retrieval label.",
    requiresExpertReview: false,
    expertReviewReason: null,
    eligibility: eligibleAll(),
  },
  {
    caseId: "blind-008",
    factsNeedingReference: ["date of alleged conduct", "rash or negligent driving", "causation of death", "departure without reporting", "commencement status of BNS section 106(2)", "potentially applicable law outside the corpus"],
    applicableLaw: null,
    referenceTop1: null,
    acceptable: [provision("BNS", "106", "Causing death by negligence")],
    sources: [source("bns-106", "Section 106(1) addresses negligent causing of death; section 106(2) text addresses negligent driving followed by failure to report."), commencement],
    justification: "The facts track BNS section 106(2), but the official commencement notification expressly excludes that subsection from commencement. The local official-source set does not resolve the resulting charging question or law outside this corpus.",
    requiresExpertReview: true,
    expertReviewReason: "The specifically matching subsection was not commenced by the available notification; a unique applicable-law and Top-1 answer cannot be assigned from this corpus alone.",
    eligibility: eligibleNone(),
  },
  {
    caseId: "blind-009",
    factsNeedingReference: ["date of alleged conduct", "repeated following", "electronic monitoring", "sex of accused and target", "indication of disinterest", "statutory exceptions"],
    applicableLaw: "IPC_ONLY",
    referenceTop1: null,
    acceptable: [provision("IPC", "354D", "Stalking")],
    sources: [source("ipc-354d", "The official comparative chart identifies IPC section 354D as stalking and maps it to BNS section 78."), source("bns-78", "BNS section 78 provides the corresponding element structure and demonstrates why the omitted facts are material."), source("bns-358", "The repeal-and-savings clause preserves IPC liability for pre-commencement conduct."), commencement],
    justification: "The date fixes the IPC framework and the official chart identifies IPC section 354D as the stalking provision. However, the case omits facts material to the statutory formulation, and the local corpus lacks primary IPC section 354D text.",
    requiresExpertReview: true,
    expertReviewReason: "A unique Top-1 label is withheld because material statutory facts and primary IPC section text are unavailable in the approved local source set.",
    eligibility: routeOnly(),
  },
  {
    caseId: "blind-010",
    factsNeedingReference: ["date of alleged conduct", "wrongful prevention from leaving", "circumscribed limits", "duration or aggravating purpose if any"],
    applicableLaw: "BNS_PRIMARY",
    referenceTop1: provision("BNS", "127", "Wrongful confinement"),
    acceptable: [provision("BNS", "127", "Wrongful confinement")],
    sources: [source("bns-127", "Section 127(1) defines wrongful confinement and section 127(2) gives the basic punishment."), commencement],
    justification: "The alleged conduct is post-commencement and directly tracks the basic wrongful-confinement rule in BNS section 127(1), with section 127(2) as the associated punishment.",
    requiresExpertReview: false,
    expertReviewReason: null,
    eligibility: eligibleAll(),
  },
];

const records = decisions.map((decision) => {
  const caseRecord = casesById.get(decision.caseId);
  if (!caseRecord) throw new Error(`Missing unlabeled case: ${decision.caseId}`);
  return {
    caseId: decision.caseId,
    caseText: caseRecord.facts,
    labelType: "OFFICIAL_SOURCE_REFERENCE_LABEL",
    ...decision,
  };
});

if (records.length !== cases.length || records.length !== 10) {
  throw new Error("Reference records must cover exactly the 10 unlabeled cases.");
}

const output = {
  evaluationType: "OFFICIAL_SOURCE_REFERENCE_EVALUATION",
  validationStatus: "NOT_INDEPENDENT_LAWYER_VALIDATION",
  disclaimer: "These labels are research references derived from official-source text in the local corpus. They are not lawyer-prepared labels, legal advice, or independent expert validation.",
  independenceMethod: "The label builder reads only candidate-cases.jsonl, statutes.json, and legal-sources/manifest.json. It does not import, read, or accept blind-predictions.json.",
  permittedCreationInputs: [
    { path: "evaluation/cases/candidate-cases.jsonl", sha256: hash(caseText) },
    { path: "backend/data/statutes.json", sha256: hash(statuteText) },
    { path: "legal-sources/manifest.json", sha256: hash(manifestText) },
  ],
  sourcePolicy: manifest.policy,
  totalCases: records.length,
  fullyResolvedProvisionReferences: records.filter((item) => item.eligibility.top1).length,
  requiresExpertReviewCases: records.filter((item) => item.requiresExpertReview).map((item) => item.caseId),
  records,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, totalCases: output.totalCases, fullyResolvedProvisionReferences: output.fullyResolvedProvisionReferences, requiresExpertReviewCases: output.requiresExpertReviewCases }, null, 2));

function provision(code, section, title) {
  return { code, section, title };
}

function source(id, support) {
  const item = statutesById.get(id.toLowerCase());
  if (!item) throw new Error(`Official corpus provision not found: ${id}`);
  return {
    document: item.source.document,
    authority: item.source.authority,
    file: item.source.file,
    pdfPage: item.source.page,
    section: `${item.code} ${item.section}`,
    sha256: item.source.sha256,
    support,
  };
}

function eligibleAll() {
  return { applicableLaw: true, top1: true, top3: true, citation: true };
}

function routeOnly() {
  return { applicableLaw: true, top1: false, top3: false, citation: false };
}

function eligibleNone() {
  return { applicableLaw: false, top1: false, top3: false, citation: false };
}

function parseJsonLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
