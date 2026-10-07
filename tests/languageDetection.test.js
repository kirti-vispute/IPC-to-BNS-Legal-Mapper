import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { runTranslationWorker, analyzeMultilingualQuery } from "../backend/core/multilingual.js";

export const fixtures = [
  ["mr", "MULTI_PERIOD_REVIEW", "फसवणुकीचे कृत्य 20 जून 2024 रोजी सुरू झाले आणि 10 जुलै 2024 पर्यंत सुरू राहिले."],
  ["hi", "IPC_ONLY", "20 जून 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया और उसे अपने पास रखने का इरादा था।"],
  ["mr", "IPC_ONLY", "20 जून 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला."],
  ["hi", "IPC_ONLY", "20 जून 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया।"],
  ["mr", "BNS_PRIMARY", "15 ऑगस्ट 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या परवानगीशिवाय घेतला."],
  ["hi", "BNS_PRIMARY", "15 अगस्त 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी अनुमति के बिना ले लिया।"],
  ["mr", "CLARIFY", "एका व्यक्तीने दुसऱ्या व्यक्तीची मालमत्ता त्याच्या संमतीशिवाय घेतली."],
  ["hi", "CLARIFY", "एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया।"]
];
const python = process.env.LOCAL_TRANSLATION_PYTHON || join(process.cwd(), ".venv-translation", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const installed = existsSync(python);

test("Marathi consensus requires model ambiguity, three families and no Hindi conflict", { skip: !installed && "Local Python setup required" }, () => {
  const program = `import importlib.util,json
s=importlib.util.spec_from_file_location('worker','backend/translation/worker.py')
w=importlib.util.module_from_spec(s);s.loader.exec_module(w)
queries=['रोजी आणि झाले','रोजी','रोजी पर्यंत','रोजी आणि झाले और','रोजी आणि झाले','रोजी आणि झाले']
ranks=[[('hi',.926),('mr',.072)]]*4+[[('hi',.999),('mr',.001)],[('ne',.926),('mr',.072)]]
print(json.dumps([w.resolve_detection(t,r) for t,r in zip(queries,ranks)]))`;
  const result = spawnSync(python, ["-X", "utf8", "-c", program], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(result.stdout);
  assert.equal(rows[0].language, "mr");
  assert.equal(rows[0].confidence, 0.072);
  for (const row of rows.slice(1)) assert.notEqual(row.detection_method, "py3langid+marathi-consensus");
});

for (const [language, route, query] of fixtures) {
  test(`real local LID: ${language} ${route} ${query.slice(0, 15)}`, { skip: !installed && "Local language detector setup required" }, async () => {
    const detected = await runTranslationWorker({ action: "detect", text: query });
    assert.equal(detected.language, language);
    assert.equal(detected.language_code, language);
    assert.ok(detected.detection_method.startsWith("py3langid"));
    const result = await analyzeMultilingualQuery(query, { worker: async payload => {
      if (payload.action === "detect") return detected;
      // Routing contract only; real translation is exercised separately by the smoke script.
      return { texts: payload.texts.map(() => payload.target === "en" ? route === "MULTI_PERIOD_REVIEW" ? "conduct began on __LEGAL_0__ and continued until __LEGAL_1__." : "a person took property without consent." : language === "mr" ? "मराठी स्पष्टीकरण" : "हिन्दी स्पष्टीकरण") };
    } });
    assert.equal(result.gate.route, route);
    assert.equal(result.multilingual.originalLanguage, language);
    if (route === "CLARIFY") { assert.equal(result.irac, null); assert.deepEqual(result.gate.allowedCodes, []); assert.ok(result.retrieved.length); }
    else assert.deepEqual(result.facts.dates.map(date => date.value).sort(), route === "MULTI_PERIOD_REVIEW" ? ["2024-06-20", "2024-07-10"] : [route === "BNS_PRIMARY" ? "2024-08-15" : "2024-06-20"]);
  });
}
