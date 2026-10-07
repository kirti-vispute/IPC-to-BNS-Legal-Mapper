import { analyzeMultilingualQuery, runTranslationWorker } from "../backend/core/multilingual.js";
import { mkdir, writeFile } from "node:fs/promises";
import { analyzeQuery } from "../backend/core/pipeline.js";

// Software smoke fixtures, not legal ground truth or a translation-accuracy benchmark.
const queries = {
  hi: "20 जून 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल फोन उसकी अनुमति के बिना लिया और उसे अपने पास रख लिया। IPC 379",
  mr: "20 जून 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला. IPC 379",
  gu: "2024-06-20 ના રોજ એક વ્યક્તિએ બીજી વ્યક્તિનો મોબાઇલ ફોન તેની સંમતિ વિના લીધો અને પોતાની પાસે રાખ્યો. IPC 379",
  bn: "2024-06-20 তারিখে একজন ব্যক্তি অন্য ব্যক্তির মোবাইল ফোন তার সম্মতি ছাড়া নিয়ে নিজের কাছে রেখেছিল। IPC 379",
  ta: "2024-06-20 அன்று ஒருவர் மற்றொருவரின் அனுமதியின்றி அவரது கைப்பேசியை எடுத்துத் தன்னிடம் வைத்துக் கொண்டார். IPC 379",
  te: "2024-06-20 న ఒక వ్యక్తి మరొక వ్యక్తి అనుమతి లేకుండా అతని మొబైల్ ఫోన్ తీసుకొని తన వద్ద ఉంచుకున్నాడు. IPC 379",
  kn: "2024-06-20 ರಂದು ಒಬ್ಬ ವ್ಯಕ್ತಿ ಇನ್ನೊಬ್ಬ ವ್ಯಕ್ತಿಯ ಅನುಮತಿಯಿಲ್ಲದೆ ಅವನ ಮೊಬೈಲ್ ಫೋನ್ ತೆಗೆದುಕೊಂಡು ತನ್ನ ಬಳಿ ಇಟ್ಟುಕೊಂಡನು. IPC 379",
  ml: "2024-06-20 ന് ഒരാൾ മറ്റൊരാളുടെ അനുവാദമില്ലാതെ അയാളുടെ മൊബൈൽ ഫോൺ എടുത്ത് സ്വന്തം കൈവശം വെച്ചു. IPC 379",
  pa: "2024-06-20 ਨੂੰ ਇੱਕ ਵਿਅਕਤੀ ਨੇ ਦੂਜੇ ਵਿਅਕਤੀ ਦਾ ਮੋਬਾਈਲ ਫੋਨ ਉਸ ਦੀ ਇਜਾਜ਼ਤ ਤੋਂ ਬਿਨਾਂ ਲਿਆ ਅਤੇ ਆਪਣੇ ਕੋਲ ਰੱਖ ਲਿਆ। IPC 379",
  ur: "2024-06-20 کو ایک شخص نے دوسرے شخص کا موبائل فون اس کی اجازت کے بغیر لیا اور اپنے پاس رکھ لیا۔ IPC 379"
};
const extraCases = [
  ["mr", "20 जून 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला."],
  ["hi", "एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल फोन उसकी अनुमति के बिना लिया और उसे अपने पास रख लिया।"],
  ["mr", "एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला आणि तो स्वतःकडे ठेवला."],
  ["mr", "12 जुलै 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला. BNS 303"],
  ["kn", "2024-06-20. ಒಬ್ಬ ವ್ಯಕ್ತಿ ಇನ್ನೊಬ್ಬ ವ್ಯಕ್ತಿಯ ಅನುಮತಿಯಿಲ್ಲದೆ ಅವನ ಮೊಬೈಲ್ ಫೋನ್ ತೆಗೆದುಕೊಂಡು ತನ್ನ ಬಳಿ ಇಟ್ಟುಕೊಂಡನು. IPC 379"]
];
const extra = process.argv.includes("--extra");
const observations = [];
const cases = extra ? extraCases : Object.entries(queries).filter(([language]) => !process.env.VERIFY_LANGUAGE || process.env.VERIFY_LANGUAGE.split(",").includes(language));
for (const [expected, query] of cases) {
  const started = Date.now();
  let lastPayload;
  try {
    const result = await analyzeMultilingualQuery(query, { worker: payload => { lastPayload = payload; return runTranslationWorker(payload); } });
    const canonical = analyzeQuery(result.multilingual?.englishQuery || query);
    const row = { language: expected, detected: result.multilingual?.originalLanguage,
      date: result.facts.offenseDate, route: result.gate.route, top1: result.retrieved[0]?.id,
      grounding: result.verifier.status, english: result.multilingual?.englishQuery,
      candidateOnly: result.candidateOnly || false, allowedCodes: result.gate.allowedCodes,
      citationsPreserved: JSON.stringify(result.irac?.citations) === JSON.stringify(canonical.irac?.citations),
      provenancePreserved: JSON.stringify(result.retrieved.map(d => d.source)) === JSON.stringify(canonical.retrieved.map(d => d.source)),
      localizedConclusion: result.multilingual?.presentation["irac.conclusion"] || result.multilingual?.presentation.candidateSummary, elapsedMs: Date.now() - started };
    observations.push(row);
    console.log(JSON.stringify(row));
  } catch (error) { const row = { language: expected, error: error.code || error.message, reason: error.reason, phase: lastPayload?.action, source: lastPayload?.source, rejectedSegment: lastPayload?.texts?.[error.segmentIndex], elapsedMs: Date.now() - started }; observations.push(row); console.log(JSON.stringify(row)); }
}
for (const text of ["20 जून 2024 को चोरी हुई।", "20 जून 2024 रोजी चोरी झाली."]) console.log(JSON.stringify({ shortInput: text, detection: await runTranslationWorker({ action: "detect", text }) }));
await mkdir("output/multilingual-verification", { recursive: true });
await writeFile(`output/multilingual-verification/${extra ? "extra" : process.env.VERIFY_LANGUAGE || "smoke"}-results.json`, JSON.stringify({ disclaimer: "Synthetic local-model software smoke tests. Not expert-reviewed translation or legal accuracy.", observations }, null, 2));
