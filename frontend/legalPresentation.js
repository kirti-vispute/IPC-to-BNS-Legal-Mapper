// Shared, DOM-free presentation contract. It formats decisions; it never selects law or ranks sources.
export const TERMINOLOGY = {
  en: {
    applicableLaw: "Applicable law", allowedCorpus: "Allowed corpus", dateRequired: "Date required", undetermined: "Undetermined", multiPeriod: "Multi-period", reviewRequired: "Review required", groundingVerification: "Grounding verification", originalStatutorySource: "Original statutory source", retrievedProvisions: "Retrieved statutory provisions", humanReviewBoundary: "Human review boundary", citationBoundReasoning: "Citation-bound reasoning", issue: "Issue", rule: "Rule", application: "Application", conclusion: "Conclusion", boundCitations: "Bound citations", relevance: "Relevance", extractedDate: "Extracted offence date", reviewWarnings: "Review warnings", candidate: "Candidate", candidatesOnly: "candidates only", sources: "sources", source: "source", originalTitle: "Original source title", noResults: "No matching statute was retrieved for the allowed corpus.", passed: "Source checks passed", translatedTitle: "Machine-translated title", noWarnings: "No review warnings for this run."
  },
  hi: {
    applicableLaw: "लागू कानून", allowedCorpus: "अनुमत संहिता-संग्रह", dateRequired: "घटना की तारीख आवश्यक", undetermined: "अनिर्धारित", multiPeriod: "एकाधिक अवधियों का मामला", reviewRequired: "समीक्षा आवश्यक", groundingVerification: "स्रोत-आधार सत्यापन", originalStatutorySource: "मूल वैधानिक स्रोत", retrievedProvisions: "प्राप्त वैधानिक प्रावधान", humanReviewBoundary: "मानवीय समीक्षा", citationBoundReasoning: "स्रोत-संदर्भ आधारित तर्क", issue: "कानूनी प्रश्न", rule: "नियम", application: "तथ्यों पर नियम का प्रयोग", conclusion: "निष्कर्ष", boundCitations: "संबद्ध स्रोत-संदर्भ", relevance: "प्रासंगिकता", extractedDate: "पहचानी गई घटना की तारीख", reviewWarnings: "समीक्षा संबंधी चेतावनियाँ", candidate: "उम्मीदवार प्रावधान", candidatesOnly: "केवल उम्मीदवार प्रावधान", sources: "स्रोत", source: "स्रोत", originalTitle: "मूल स्रोत का शीर्षक", noResults: "अनुमत संहिता-संग्रह में कोई मेल खाता प्रावधान नहीं मिला।", passed: "स्रोत जाँच पूर्ण", translatedTitle: "मशीन-अनूदित शीर्षक", noWarnings: "इस परिणाम के लिए कोई समीक्षा चेतावनी नहीं है।"
  },
  mr: {
    applicableLaw: "लागू कायदा", allowedCorpus: "अनुमत संहिता-संग्रह", dateRequired: "घटनेची तारीख आवश्यक", undetermined: "अनिर्धारित", multiPeriod: "एकाधिक कालावधींचे प्रकरण", reviewRequired: "पुनरावलोकन आवश्यक", groundingVerification: "स्रोत-आधार पडताळणी", originalStatutorySource: "मूळ वैधानिक स्रोत", retrievedProvisions: "प्राप्त वैधानिक तरतुदी", humanReviewBoundary: "मानवी पुनरावलोकन", citationBoundReasoning: "स्रोत-संदर्भांवर आधारित तर्क", issue: "कायदेशीर प्रश्न", rule: "नियम", application: "तथ्यांवर नियमाचा वापर", conclusion: "निष्कर्ष", boundCitations: "संबद्ध स्रोत-संदर्भ", relevance: "प्रासंगिकता", extractedDate: "ओळखलेली घटनेची तारीख", reviewWarnings: "पुनरावलोकनाच्या सूचना", candidate: "उमेदवार तरतूद", candidatesOnly: "केवळ उमेदवार तरतुदी", sources: "स्रोत", source: "स्रोत", originalTitle: "मूळ स्रोताचे शीर्षक", noResults: "अनुमत संहिता-संग्रहात जुळणारी तरतूद मिळाली नाही.", passed: "स्रोत पडताळणी पूर्ण", translatedTitle: "यंत्र-अनुवादित शीर्षक", noWarnings: "या निकालासाठी पुनरावलोकनाची सूचना नाही."
  }
};

const COPY = {
  en: {
    pre: ["The alleged offence date is before ", ". IPC applies; BNS is not used as the applicable law."],
    post: ["The alleged offence date is on or after ", ". BNS is primary, with IPC available only for controlled cross-reference context."],
    span: "The facts span the IPC/BNS transition. Both corpora are searched; human review is required.",
    missing: "The alleged offence date is missing. Applicable law remains undetermined. These provisions are candidates only; supply the offence date before relying on an applicable-law decision.",
    ambiguous: "A clear alleged offence date is required. Applicable law cannot be selected from the current date information.",
    issue: ["Determine the applicable statutory framework for facts dated ", "."],
    sections: "Section references in the query: ", features: "Original English extraction keywords: ",
    retrieved: "Retrieved candidate provisions: ", scope: " The output is limited to the corpus allowed by the Applicable Law Check.",
    conclusion: ["The strongest retrieved candidate is ", "."], bounded: " This result remains bounded to the retrieved source text.", review: " Human review is required before relying on the mapping.",
    noSource: "No retrieved source text is available for grounded synthesis.", noConclusion: "The conclusion does not name a retrieved section.",
    machineNotice: "Machine translation may contain errors. Verify against the original source. Controlled terminology is project-maintained, not expert-certified."
  },
  hi: {
    pre: ["कथित घटना की तारीख ", " से पहले है। IPC लागू है; BNS को लागू कानून के रूप में उपयोग नहीं किया जाता।"],
    post: ["कथित घटना की तारीख ", " को या उसके बाद की है। BNS प्राथमिक है; IPC केवल नियंत्रित तुलनात्मक संदर्भ के लिए उपलब्ध है।"],
    span: "घटना की अवधि IPC/BNS संक्रमण के दोनों ओर है। दोनों संहिता-संग्रह खोजे जाते हैं; मानवीय समीक्षा आवश्यक है।",
    missing: "कथित घटना की तारीख नहीं दी गई है। लागू कानून अनिर्धारित है। दिखाई गए प्रावधान केवल उम्मीदवार हैं; लागू कानून तय करने के लिए घटना की तारीख दें।",
    ambiguous: "कथित घटना की स्पष्ट तारीख आवश्यक है। वर्तमान तारीख-संबंधी जानकारी से लागू कानून नहीं चुना जा सकता।",
    issue: ["इन तारीखों के तथ्यों के लिए लागू वैधानिक व्यवस्था का निर्धारण करें: ", "।"],
    sections: "प्रश्न में उल्लिखित धारा-संदर्भ: ", features: "निष्कर्षण के मूल अंग्रेज़ी संकेतशब्द: ",
    retrieved: "प्राप्त उम्मीदवार प्रावधान: ", scope: " उत्तर लागू कानून की जाँच द्वारा अनुमत संहिता-संग्रह तक सीमित है।",
    conclusion: ["सबसे उच्च स्थान पर प्राप्त उम्मीदवार प्रावधान ", " है।"], bounded: " परिणाम प्राप्त स्रोत-पाठ तक सीमित है।", review: " मानचित्रण पर भरोसा करने से पहले मानवीय समीक्षा आवश्यक है।",
    noSource: "स्रोत-आधारित विवेचन के लिए कोई स्रोत-पाठ प्राप्त नहीं हुआ।", noConclusion: "निष्कर्ष में प्राप्त धारा का उल्लेख नहीं है।",
    machineNotice: "मशीन अनुवाद में त्रुटियाँ हो सकती हैं। मूल स्रोत से सत्यापित करें। नियंत्रित शब्दावली परियोजना में निर्धारित है; विशेषज्ञ-प्रमाणित नहीं है।"
  },
  mr: {
    pre: ["कथित घटनेची तारीख ", " पूर्वीची आहे. IPC लागू आहे; BNS लागू कायदा म्हणून वापरला जात नाही."],
    post: ["कथित घटनेची तारीख ", " या दिवशी किंवा त्यानंतरची आहे. BNS प्राथमिक आहे; IPC केवळ नियंत्रित तुलनात्मक संदर्भासाठी उपलब्ध आहे."],
    span: "घटनेचा कालावधी IPC/BNS संक्रमणाच्या दोन्ही बाजूंना आहे. दोन्ही संहिता-संग्रह शोधले जातात; मानवी पुनरावलोकन आवश्यक आहे.",
    missing: "कथित घटनेची तारीख दिलेली नाही. लागू कायदा अनिर्धारित आहे. दाखवलेल्या तरतुदी केवळ उमेदवार आहेत; लागू कायदा ठरवण्यासाठी घटनेची तारीख द्या.",
    ambiguous: "कथित घटनेची स्पष्ट तारीख आवश्यक आहे. सध्याच्या तारीखविषयक माहितीतून लागू कायदा निवडता येत नाही.",
    issue: ["या तारखांच्या तथ्यांसाठी लागू वैधानिक चौकट निश्चित करा: ", "."],
    sections: "प्रश्नात नमूद केलेले कलम-संदर्भ: ", features: "निष्कर्षणातील मूळ इंग्रजी संकेतशब्द: ",
    retrieved: "प्राप्त उमेदवार तरतुदी: ", scope: " उत्तर लागू कायद्याच्या तपासणीने अनुमत केलेल्या संहिता-संग्रहापुरते मर्यादित आहे.",
    conclusion: ["सर्वोच्च क्रमाने प्राप्त उमेदवार तरतूद ", " आहे."], bounded: " निकाल प्राप्त स्रोत-मजकुरापुरता मर्यादित आहे.", review: " मानचित्रणावर अवलंबून राहण्यापूर्वी मानवी पुनरावलोकन आवश्यक आहे.",
    noSource: "स्रोत-आधारित विवेचनासाठी स्रोत-मजकूर प्राप्त झालेला नाही.", noConclusion: "निष्कर्षात प्राप्त कलमाचा उल्लेख नाही.",
    machineNotice: "यंत्र-अनुवादात चुका असू शकतात. मूळ स्रोताशी पडताळणी करा. नियंत्रित शब्दावली प्रकल्पात निश्चित केलेली आहे; तज्ज्ञांनी प्रमाणित केलेली नाही."
  }
};

const prose = value => ({ kind: "prose", value });
const literal = value => ({ kind: "literal", value: String(value) });
export const plainText = nodes => nodes.map(node => node.value).join("");

const INTERFACE_TEXT = {
  eyebrow: "Neuro-symbolic statutory retrieval", subtitle: "Date-aware statutory retrieval with citation-bound IRAC synthesis",
  workflowQuery: "Query", workflowDate: "Date extraction", workflowLaw: "Applicable law", workflowRetrieval: "Retrieval",
  workspace: "Legal analysis workspace", queryHeading: "Natural-language legal query", queryPrompt: "Enter case facts or a legal query",
  queryPlaceholder: "Enter or paste the case facts, including the alleged offence date when available...",
  writtenLanguage: "Written language", spokenLanguage: "Spoken language", autoDetect: "Auto detect", analyze: "Analyze query",
  ready: "Ready for analysis", serviceOnline: "Service online", serviceUnavailable: "Service unavailable", serviceOffline: "Service offline",
  startRecording: "Start recording", voiceReady: "Local speech recognition ready", voiceSetup: "Local speech setup required",
  input: "Input", inputMode: "Input mode", processing: "Processing", output: "Output", textMode: "Text", voiceMode: "Voice", selected: "selected",
  officialRetrieval: "Official-source retrieval", iracSynthesis: "IRAC synthesis", demoHeading: "Evaluation / Demo Cases",
  demoDescription: "Classroom test inputs for demonstrating temporal routing and review states. These are not user-facing legal categories.",
  demoPre: "Pre-transition theft", demoPost: "Post-transition organized crime", demoSpan: "Continuing offense", demoMissing: "Missing date"
};

const INTERFACE_NATIVE = {
  hi: {
    eyebrow: "न्यूरो-सिंबॉलिक वैधानिक खोज", subtitle: "तारीख के अनुसार वैधानिक खोज और स्रोत-आधारित IRAC विवेचन",
    workflowQuery: "प्रश्न", workflowDate: "तारीख पहचान", workflowLaw: "लागू कानून", workflowRetrieval: "खोज",
    workspace: "कानूनी विश्लेषण", queryHeading: "सामान्य भाषा में कानूनी प्रश्न", queryPrompt: "घटना के तथ्य या कानूनी प्रश्न लिखें",
    queryPlaceholder: "घटना के तथ्य लिखें या पेस्ट करें। उपलब्ध हो तो कथित अपराध की तारीख भी लिखें...",
    writtenLanguage: "लिखित भाषा", spokenLanguage: "बोली जाने वाली भाषा", autoDetect: "स्वचालित पहचान", analyze: "विश्लेषण करें",
    ready: "विश्लेषण के लिए तैयार", serviceOnline: "सेवा उपलब्ध", serviceUnavailable: "सेवा उपलब्ध नहीं", serviceOffline: "सेवा बंद",
    startRecording: "रिकॉर्डिंग शुरू करें", voiceReady: "स्थानीय वाणी पहचान तैयार", voiceSetup: "वाणी पहचान की स्थापना आवश्यक",
    input: "इनपुट", inputMode: "इनपुट का प्रकार", processing: "प्रक्रिया", output: "परिणाम", textMode: "पाठ", voiceMode: "आवाज़", selected: "चयनित",
    officialRetrieval: "आधिकारिक स्रोतों में खोज", iracSynthesis: "IRAC विवेचन", demoHeading: "मूल्यांकन / प्रदर्शन उदाहरण",
    demoDescription: "कक्षा में तारीख के अनुसार लागू कानून और समीक्षा की स्थिति दिखाने के परीक्षण उदाहरण।",
    demoPre: "संक्रमण से पहले की चोरी", demoPost: "संक्रमण के बाद का संगठित अपराध", demoSpan: "जारी अपराध", demoMissing: "तारीख अनुपलब्ध"
  },
  mr: {
    eyebrow: "न्यूरो-सिंबॉलिक वैधानिक शोध", subtitle: "तारखेनुसार वैधानिक शोध आणि स्रोत-आधारित IRAC विवेचन",
    workflowQuery: "प्रश्न", workflowDate: "तारीख ओळख", workflowLaw: "लागू कायदा", workflowRetrieval: "शोध",
    workspace: "कायदेशीर विश्लेषण", queryHeading: "सामान्य भाषेतील कायदेशीर प्रश्न", queryPrompt: "घटनेची तथ्ये किंवा कायदेशीर प्रश्न लिहा",
    queryPlaceholder: "घटनेची तथ्ये लिहा किंवा पेस्ट करा. उपलब्ध असल्यास कथित गुन्ह्याची तारीखही लिहा...",
    writtenLanguage: "लिखित भाषा", spokenLanguage: "बोलण्याची भाषा", autoDetect: "स्वयंचलित ओळख", analyze: "विश्लेषण करा",
    ready: "विश्लेषणासाठी तयार", serviceOnline: "सेवा उपलब्ध", serviceUnavailable: "सेवा उपलब्ध नाही", serviceOffline: "सेवा बंद",
    startRecording: "रेकॉर्डिंग सुरू करा", voiceReady: "स्थानिक वाणी ओळख तयार", voiceSetup: "वाणी ओळख प्रणालीची स्थापना आवश्यक",
    input: "इनपुट", inputMode: "इनपुटचा प्रकार", processing: "प्रक्रिया", output: "निकाल", textMode: "मजकूर", voiceMode: "आवाज", selected: "निवडलेली",
    officialRetrieval: "अधिकृत स्रोतांतील शोध", iracSynthesis: "IRAC विवेचन", demoHeading: "मूल्यमापन / प्रात्यक्षिक उदाहरणे",
    demoDescription: "वर्गात तारखेनुसार लागू कायदा आणि पुनरावलोकनाची स्थिती दाखवण्यासाठी चाचणी उदाहरणे.",
    demoPre: "संक्रमणापूर्वीची चोरी", demoPost: "संक्रमणानंतरचा संघटित गुन्हा", demoSpan: "सुरू असलेला गुन्हा", demoMissing: "तारीख उपलब्ध नाही"
  }
};

export function staticPresentationTexts() {
  return [...Object.values(TERMINOLOGY.en), ...Object.values(INTERFACE_TEXT), ...Object.values(COPY.en).flat()];
}

export function createLegalPresentation(result, language, commencementDate) {
  const labels = { ...(TERMINOLOGY[language] || TERMINOLOGY.en) };
  const copy = COPY[language] || COPY.en;
  const dates = [...new Set(result.facts.dates.map(date => date.value))].sort();
  const commencement = new Date(`${commencementDate}T00:00:00Z`);
  const writtenDate = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(commencement);
  const localizedDate = new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(commencement);
  const explanation = result.gate.route === "IPC_ONLY" ? [prose(copy.pre[0]), literal(writtenDate), prose(copy.pre[1])]
    : result.gate.route === "BNS_PRIMARY" ? [prose(copy.post[0]), literal(writtenDate), prose(copy.post[1])]
    : [prose(result.gate.route === "MULTI_PERIOD_REVIEW" ? copy.span : result.candidateOnly ? copy.missing : copy.ambiguous)];
  const provisions = result.retrieved.map(doc => ({
    id: doc.id, provisionCode: `${doc.code} ${doc.section}`, code: doc.code, section: doc.section,
    relevance: doc.score, title: doc.title, originalTitle: doc.title, sourceText: doc.excerpt, sourceLanguage: "en",
    sourceName: doc.source.authority, fileName: doc.source.file, pdfPage: doc.source.page,
    url: doc.source.url, source: { ...doc.source }, commencementException: doc.commencementException || null
  }));
  const references = provisions.flatMap((doc, index) => [...(index ? [prose(", ")] : []), literal(doc.provisionCode)]);
  const application = [];
  if (result.facts.sectionRefs.length) application.push(prose(copy.sections), literal(result.facts.sectionRefs.map(ref => `${ref.code || "Section"} ${ref.section}`).join(", ")), prose(". "));
  if (result.facts.keywords.length) application.push(prose(copy.features), literal(result.facts.keywords.join(", ")), prose(". "));
  application.push(prose(copy.retrieved), ...references, prose(copy.scope));
  const period = result.facts.offenseDate || dates.join(" / ");
  const irac = result.irac ? {
    issue: result.gate.route === "CLARIFY" ? [prose(copy.ambiguous)] : [prose(copy.issue[0]), literal(period), prose(copy.issue[1])],
    rule: explanation.map(node => ({ ...node })), application,
    conclusion: result.gate.route === "CLARIFY" ? [prose(copy.ambiguous)] : provisions.length
      ? [prose(copy.conclusion[0]), literal(provisions[0].provisionCode), prose(copy.conclusion[1]), prose(result.gate.reviewRequired ? copy.review : copy.bounded)]
      : [prose(copy.noSource)],
    sourceIds: provisions.map(doc => doc.id), citations: [...result.irac.citations]
  } : null;
  const warnings = result.verifier.warnings.map(warning => {
    if (warning === result.gate.message) return explanation.map(node => ({ ...node }));
    if (warning === "Conclusion does not name a retrieved section.") return [prose(copy.noConclusion)];
    if (warning === "No retrieved source text is available for grounded synthesis.") return [prose(copy.noSource)];
    // Only source-bound exception notes are literal; system review guidance may be localized.
    return [/^(?:IPC|BNS)\s+\d/i.test(warning) ? literal(warning) : prose(warning)];
  });
  warnings.push([prose(copy.machineNotice)]);
  return {
    schemaVersion: 2, inputLanguage: language, processingLanguage: "en", outputLanguage: language, labels,
    interfaceText: { ...INTERFACE_TEXT, ...(INTERFACE_NATIVE[language] || {}) },
    interfaceLocalization: INTERFACE_NATIVE[language] ? "controlled-draft" : "english-source",
    decision: { route: result.gate.route, candidateOnly: Boolean(result.candidateOnly), applicability: result.gate.applicability || result.gate.route,
      allowedCodes: [...result.gate.allowedCodes], candidateCodes: [...(result.gate.candidateCodes || [])], canonicalDates: dates,
      offenceDate: result.facts.offenseDate, commencementDate, writtenCommencementDate: writtenDate, localizedCommencementDate: localizedDate,
      routeLabel: result.candidateOnly ? labels.dateRequired : result.gate.route === "IPC_ONLY" ? `IPC · ${labels.applicableLaw}` : result.gate.route === "BNS_PRIMARY" ? `BNS · ${labels.applicableLaw}` : result.gate.route === "MULTI_PERIOD_REVIEW" ? `${labels.multiPeriod} · ${labels.reviewRequired}` : labels.dateRequired,
      explanation, verifierStatus: result.verifier.status, verifierLabel: result.verifier.status === "PASSED" ? labels.passed : labels.reviewRequired },
    provisions, irac, candidateSummary: result.candidateOnly ? [prose(`${labels.candidatesOnly}: `), ...references, prose(". "), ...explanation] : null, warnings
  };
}

// An explicit allowlist: no source text, dates, scores, citations or metadata are translation targets.
export function presentationTranslationTargets(view, includeSystemProse = false) {
  const targets = view.provisions.map(doc => ({ get: () => doc.title, set: value => { doc.title = value; } }));
  if (!includeSystemProse) return targets;
  for (const key of Object.keys(view.labels)) targets.push({ get: () => view.labels[key], set: value => { view.labels[key] = value; } });
  for (const key of Object.keys(view.interfaceText)) targets.push({ get: () => view.interfaceText[key], set: value => { view.interfaceText[key] = value; } });
  const groups = [view.decision.explanation, ...view.warnings, view.candidateSummary, ...Object.values(view.irac || {}).filter(value => Array.isArray(value) && value[0]?.kind)];
  for (const group of groups.filter(Boolean)) for (const node of group) if (node.kind === "prose") targets.push({ get: () => node.value, set: value => { node.value = value; } });
  return targets;
}

export function syncDecisionLabels(view) {
  const { labels, decision } = view;
  decision.routeLabel = decision.candidateOnly ? labels.dateRequired : decision.route === "IPC_ONLY" ? `IPC · ${labels.applicableLaw}` : decision.route === "BNS_PRIMARY" ? `BNS · ${labels.applicableLaw}` : decision.route === "MULTI_PERIOD_REVIEW" ? `${labels.multiPeriod} · ${labels.reviewRequired}` : labels.dateRequired;
  decision.verifierLabel = decision.verifierStatus === "PASSED" ? labels.passed : labels.reviewRequired;
}

const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const renderNodes = nodes => nodes.map(node => node.kind === "literal" ? `<bdi class="legal-literal" lang="en">${escape(node.value)}</bdi>` : escape(node.value)).join("");
const originalSource = (doc, labels) => `<details class="statutory-source" open><summary>${escape(labels.originalStatutorySource)}</summary><p class="original-title" lang="en">${escape(doc.originalTitle)}</p><p class="source-text" dir="ltr" lang="en">${escape(doc.sourceText)}</p></details>`;

export function renderLegalPresentation(view) {
  const labels = view.labels;
  return {
    retrievalHtml: view.provisions.length ? view.provisions.map(doc => `<li class="retrieval-item" data-provision-id="${escape(doc.id)}">
      <div class="provision-heading"><strong class="provision-code" dir="ltr">${escape(doc.provisionCode)}${view.decision.candidateOnly ? ` · ${escape(labels.candidate)}` : ""}</strong><span class="score"><span aria-hidden="true"> · </span><span>${escape(labels.relevance)}: </span><bdi class="relevance-value" dir="ltr">${escape(doc.relevance)}</bdi></span></div>
      <h3 dir="auto" lang="${escape(view.outputLanguage)}">${escape(doc.title)}</h3><small>${escape(labels.translatedTitle)}</small>
      ${originalSource(doc, labels)}<small class="source-line" lang="en" dir="ltr">${escape(doc.sourceName)}<br>${escape(doc.fileName)} · PDF page ${escape(doc.pdfPage)}</small></li>`).join("") : `<li class="empty">${escape(labels.noResults)}</li>`,
    iracHtml: view.candidateSummary ? `<p dir="auto">${renderNodes(view.candidateSummary)}</p>` : ["issue", "rule", "application", "conclusion"].map(key => `<section class="irac-section"><h3>${escape(labels[key])}</h3><p dir="auto">${renderNodes(view.irac[key])}</p>${key === "rule" ? view.provisions.map(doc => originalSource(doc, labels)).join("") : ""}</section>`).join(""),
    citationsHtml: view.irac?.citations.length ? `<h3>${escape(labels.boundCitations)}</h3><ul>${view.irac.citations.map(citation => `<li lang="en" dir="ltr">${escape(citation)}</li>`).join("")}</ul>` : "",
    warningsHtml: view.warnings.map(nodes => `<li dir="auto">${renderNodes(nodes)}</li>`).join(""),
    explanationText: plainText(view.decision.explanation)
  };
}
