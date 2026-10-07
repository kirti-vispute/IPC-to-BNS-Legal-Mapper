// NLP analysis panel and pipeline-flow section. Everything shown here comes from the backend (/api/nlp/pipeline, the
// transcription result, the analysis result); nothing is typed in by hand. The DOM is built with textContent only,
// never with HTML strings, because transcripts and entities originate from user speech.

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const clear = node => { while (node.firstChild) node.removeChild(node.firstChild); };
const pct = value => `${Math.round(value * 100)}%`;

const ENTITY_LABELS = { DATE: "Date", SECTION: "Section", LAW: "Law", MONEY: "Money", OFFENCE: "Offence" };
const CATEGORY_NAMES = { NLP: "NLP", DL: "Deep learning", ML: "Machine learning", AML: "Applied ML" };

/* ---------------- NLP analysis panel ---------------- */

function card(title, ...children) {
  const section = el("section", "nlp-card");
  section.appendChild(el("h3", "nlp-card-title", title));
  children.forEach(child => section.appendChild(child));
  return section;
}

function chips(items, build, empty) {
  const row = el("div", "nlp-chips");
  if (!items.length) row.appendChild(el("span", "nlp-empty", empty));
  items.forEach(item => row.appendChild(build(item)));
  return row;
}

function stepRibbon(analysis, transcription) {
  const ribbon = el("ol", "nlp-steps");
  const stats = analysis.stats;
  const steps = [
    ["Language", analysis.language.name],
    ["Normalize", (count => `${count} ${count === 1 ? "fix" : "fixes"}`)((transcription?.corrections || analysis.normalization.corrections).length)],
    ["Sentences", String(stats.sentences)],
    ["Tokens", String(stats.tokens)],
    ["Stop-words", String(stats.stopwords)],
    ["Stems", String(analysis.stems.length)],
    ["Entities", String(stats.entities)],
    ["Keyphrases", String(analysis.keyphrases.length)]
  ];
  steps.forEach(([name, value], index) => {
    const item = el("li", "nlp-step");
    item.appendChild(el("span", "nlp-step-index", String(index + 1)));
    item.appendChild(el("span", "nlp-step-name", name));
    item.appendChild(el("strong", "nlp-step-value", value));
    ribbon.appendChild(item);
  });
  return ribbon;
}

function transcriptCard(detail) {
  const { nlp, transcription } = detail;
  const body = el("div", "nlp-transcript");
  const corrections = transcription?.corrections || nlp.normalization.corrections;
  if (transcription?.rawText && transcription.rawText !== nlp.normalization.text) {
    const raw = el("p", "nlp-raw");
    raw.appendChild(el("span", "nlp-tag", "Recognized"));
    raw.appendChild(el("span", "nlp-text", transcription.rawText));
    raw.dir = "auto";
    body.appendChild(raw);
  }
  const final = el("p", "nlp-final");
  final.appendChild(el("span", "nlp-tag nlp-tag-final", "Final"));
  const text = el("span", "nlp-text", nlp.normalization.text);
  text.dir = "auto";
  final.appendChild(text);
  body.appendChild(final);
  body.appendChild(chips(corrections, item => {
    const chip = el("span", `nlp-chip nlp-fix nlp-fix-${item.kind}`);
    chip.appendChild(el("span", "nlp-fix-from", item.from));
    chip.appendChild(el("span", "nlp-fix-arrow", "→"));
    chip.appendChild(el("strong", "nlp-fix-to", item.to));
    chip.title = `Automatic ${item.kind} correction`;
    return chip;
  }, "No automatic corrections were needed."));
  return card("Transcript and normalization", body);
}

function confidenceCard(transcription) {
  if (!transcription || transcription.confidence === null || transcription.confidence === undefined) return null;
  const body = el("div", "nlp-confidence");
  const meter = el("div", "nlp-meter");
  const fill = el("span", "nlp-meter-fill");
  fill.style.width = pct(transcription.confidence);
  meter.appendChild(fill);
  body.appendChild(meter);
  body.appendChild(el("p", "nlp-note", `Average ${transcription.confidenceLevel}-level confidence ${pct(transcription.confidence)}. These are model probabilities, not guarantees.`));
  const uncertain = transcription.confidenceLevel === "word" ? transcription.uncertainWords.map(item => ({ label: item.word, probability: item.probability }))
    : transcription.uncertainSegments.map(item => ({ label: item.text, probability: item.probability }));
  body.appendChild(chips(uncertain, item => {
    const chip = el("span", "nlp-chip nlp-uncertain");
    chip.appendChild(el("span", "", item.label));
    chip.appendChild(el("strong", "", pct(item.probability)));
    chip.dir = "auto";
    return chip;
  }, "No low-confidence spans."));
  return card(transcription.confidenceLevel === "word" ? "Check these words" : "Check these segments", body);
}

function tokensCard(analysis) {
  const shown = analysis.tokens.filter(token => token.type !== "punct").slice(0, 70);
  const row = chips(shown, token => {
    const chip = el("span", `nlp-chip nlp-token${token.stopword ? " is-stop" : ""}${token.negation ? " is-negation" : ""}${token.type === "number" ? " is-number" : ""}`);
    chip.appendChild(el("span", "nlp-token-text", token.text));
    if (token.stem) chip.appendChild(el("small", "nlp-token-stem", token.stem));
    chip.dir = "auto";
    chip.title = token.negation ? "Negation: kept, it changes legal meaning" : token.stopword ? "Stop-word" : token.stem ? `Stem: ${token.stem}` : token.type;
    return chip;
  }, "No tokens.");
  const more = analysis.stats.tokens - analysis.tokens.length;
  const legend = el("p", "nlp-note", "Muted = stop-word, outlined = negation (kept), small text = stem. Stemming is light suffix stripping, not lemmatization.");
  const wrap = el("div", "");
  wrap.appendChild(row);
  if (more > 0) wrap.appendChild(el("p", "nlp-note", `+${more} more tokens not shown.`));
  wrap.appendChild(legend);
  return card(`Tokens (${analysis.stats.tokens})`, wrap);
}

function entitiesCard(analysis) {
  const row = chips(analysis.entities, entity => {
    const chip = el("span", `nlp-chip nlp-entity nlp-entity-${entity.type}`);
    chip.appendChild(el("small", "nlp-entity-type", ENTITY_LABELS[entity.type] || entity.type));
    chip.appendChild(el("span", "nlp-entity-text", entity.text));
    if (String(entity.value) !== entity.text) chip.appendChild(el("strong", "nlp-entity-value", String(entity.value)));
    chip.dir = "auto";
    chip.title = `Found by ${entity.source}`;
    return chip;
  }, "No dates, sections, laws, amounts or offence terms found.");
  return card("Named entities", row, el("p", "nlp-note", `Method: ${analysis.capabilities.namedEntities.method}. Persons, places and organizations are not recognized.`));
}

function keyphrasesCard(analysis) {
  const list = el("ol", "nlp-keys");
  const top = analysis.keyphrases[0]?.score || 1;
  analysis.keyphrases.forEach(item => {
    const row = el("li", "nlp-key");
    const label = el("span", "nlp-key-label", item.phrase);
    label.dir = "auto";
    const bar = el("span", "nlp-key-bar");
    const fill = el("span", "nlp-key-fill");
    fill.style.width = `${Math.max(8, Math.round((item.score / top) * 100))}%`;
    bar.appendChild(fill);
    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(el("span", "nlp-key-score", String(item.score)));
    list.appendChild(row);
  });
  if (!analysis.keyphrases.length) list.appendChild(el("li", "nlp-empty", "No keyphrases."));
  return card("Keyphrases (RAKE)", list);
}

function classificationCard(detail) {
  const body = el("div", "");
  const facts = detail.facts;
  const tagged = detail.nlp.classification;
  if (facts && Array.isArray(facts.concepts)) {
    body.appendChild(chips(facts.concepts, concept => el("span", "nlp-chip nlp-concept", concept.replaceAll("_", " ")), "No legal concept was tagged."));
    if (facts.keywords?.length) body.appendChild(el("p", "nlp-note", `Legal terms in the English processing text: ${facts.keywords.join(", ")}`));
    body.appendChild(el("p", "nlp-note", "Existing rule-based tagger, applied to the English processing text used for statute retrieval."));
  } else if (tagged.available) {
    body.appendChild(chips(tagged.concepts, concept => el("span", "nlp-chip nlp-concept", concept.replaceAll("_", " ")), "No legal concept was tagged."));
    body.appendChild(el("p", "nlp-note", "Existing rule-based tagger (English text)."));
  } else {
    body.appendChild(el("p", "nlp-note", "Legal concept tagging runs on English text. For this language it happens after translation when you press Analyze."));
  }
  return card("Classification", body);
}

function limitsCard(analysis) {
  const list = el("ul", "nlp-limits");
  [
    ["Lemmatization", analysis.capabilities.lemmatization],
    ["Person / place / organization recognition", false],
    ["Sentiment analysis", analysis.capabilities.sentiment]
  ].forEach(([name, available]) => list.appendChild(el("li", available ? "is-yes" : "is-no", `${name}: ${available ? "available" : "not implemented"}`)));
  return card("Not implemented", list);
}

function renderAnalysis(root, detail) {
  const { nlp } = detail;
  clear(root);
  root.hidden = false;
  const head = el("div", "nlp-head");
  const title = el("div", "");
  title.appendChild(el("p", "section-kicker", detail.source === "speech" ? "From the recording" : "From the analyzed text"));
  title.appendChild(el("h2", "", "NLP analysis"));
  head.appendChild(title);
  const meta = el("div", "nlp-meta");
  meta.appendChild(el("span", "nlp-pill nlp-pill-lang", `${nlp.language.name}${nlp.language.ambiguous ? " (script shared with " + nlp.language.alternatives.join(", ") + ")" : ""}`));
  if (detail.model) meta.appendChild(el("span", "nlp-pill", detail.model));
  head.appendChild(meta);
  root.appendChild(head);
  root.appendChild(stepRibbon(nlp, detail.transcription));
  const grid = el("div", "nlp-grid");
  grid.appendChild(transcriptCard(detail));
  const confidence = confidenceCard(detail.transcription);
  if (confidence) grid.appendChild(confidence);
  grid.appendChild(entitiesCard(nlp));
  grid.appendChild(keyphrasesCard(nlp));
  grid.appendChild(tokensCard(nlp));
  grid.appendChild(classificationCard(detail));
  grid.appendChild(limitsCard(nlp));
  root.appendChild(grid);
}

/* ---------------- Pipeline flow ---------------- */

function renderFlow(root, description) {
  clear(root);
  const head = el("div", "flow-head");
  const title = el("div", "");
  title.appendChild(el("p", "section-kicker", "Under the hood"));
  title.appendChild(el("h2", "", "How the language pipeline works"));
  title.appendChild(el("p", "flow-lead", "Every stage below is code in this project. Filter by the kind of technique, or play the flow from audio to answer."));
  head.appendChild(title);
  const controls = el("div", "flow-controls");
  const filters = el("div", "flow-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Filter stages by technique");
  let active = "ALL";
  const stageNodes = [];
  const apply = () => {
    stageNodes.forEach(({ node, stage }) => {
      const match = active === "ALL" || stage.categories.includes(active);
      node.classList.toggle("is-dim", !match);
    });
    filters.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === active)));
  };
  [["ALL", "All"], ...Object.keys(description.categories).map(key => [key, CATEGORY_NAMES[key] || key])].forEach(([key, label]) => {
    const button = el("button", `flow-filter flow-filter-${key}`, label);
    button.type = "button";
    button.dataset.filter = key;
    button.setAttribute("aria-pressed", String(key === "ALL"));
    if (description.categories[key]) button.title = description.categories[key];
    button.addEventListener("click", () => { active = key; apply(); });
    filters.appendChild(button);
  });
  controls.appendChild(filters);
  const play = el("button", "flow-play", "Play the flow");
  play.type = "button";
  controls.appendChild(play);
  head.appendChild(controls);
  root.appendChild(head);

  const detail = el("div", "flow-detail");
  detail.setAttribute("aria-live", "polite");
  detail.appendChild(el("p", "nlp-note", "Select a stage to see what it does and where the code is."));

  const showStage = stage => {
    clear(detail);
    detail.appendChild(el("h3", "flow-detail-title", stage.title));
    detail.appendChild(el("p", "", stage.detail));
    const tags = el("div", "nlp-chips");
    stage.concepts.forEach(concept => tags.appendChild(el("span", "nlp-chip flow-concept", concept)));
    detail.appendChild(tags);
    detail.appendChild(el("p", "nlp-note flow-file", `Code: ${stage.file}`));
  };

  const lanes = el("div", "flow-lanes");
  let counter = 0;
  description.groups.forEach(group => {
    const lane = el("section", `flow-lane flow-lane-${group.id}`);
    const laneHead = el("header", "flow-lane-head");
    laneHead.appendChild(el("h3", "", group.title));
    laneHead.appendChild(el("span", "", group.blurb));
    lane.appendChild(laneHead);
    const track = el("ol", "flow-track");
    description.stages.filter(stage => stage.group === group.id).forEach(stage => {
      counter++;
      const item = el("li", "flow-stage");
      const button = el("button", "flow-stage-button");
      button.type = "button";
      button.appendChild(el("span", "flow-stage-index", String(counter)));
      const text = el("span", "flow-stage-text");
      text.appendChild(el("strong", "", stage.title));
      const pills = el("span", "flow-pills");
      stage.categories.forEach(category => pills.appendChild(el("span", `flow-pill flow-pill-${category}`, category)));
      text.appendChild(pills);
      button.appendChild(text);
      button.addEventListener("click", () => {
        stageNodes.forEach(entry => entry.node.classList.remove("is-selected"));
        item.classList.add("is-selected");
        showStage(stage);
      });
      item.appendChild(button);
      track.appendChild(item);
      stageNodes.push({ node: item, stage });
    });
    lane.appendChild(track);
    lanes.appendChild(lane);
  });
  root.appendChild(lanes);
  root.appendChild(detail);

  // "Play" walks the signal through the stages in order. With reduced motion it simply selects the first stage.
  let timer = null;
  play.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = "Play the flow"; stageNodes.forEach(entry => entry.node.classList.remove("is-playing")); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) { stageNodes[0].node.querySelector("button").click(); return; }
    let index = 0;
    play.textContent = "Stop";
    const step = () => {
      stageNodes.forEach(entry => entry.node.classList.remove("is-playing"));
      if (index >= stageNodes.length) { clearInterval(timer); timer = null; play.textContent = "Play the flow"; return; }
      const { node, stage } = stageNodes[index++];
      node.classList.add("is-playing");
      showStage(stage);
      node.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
    };
    step();
    timer = setInterval(step, 900);
  });

  root.appendChild(registryTable(description.registry));
  if (description.evaluation) root.appendChild(evaluationTable(description.evaluation));
  root.hidden = false;
}

function registryTable(registry) {
  const wrap = el("div", "flow-table-wrap");
  wrap.appendChild(el("h3", "flow-table-title", "Language-specific speech models"));
  const table = el("table", "flow-table");
  const header = el("tr");
  ["Language", "Model", "Source", "Status", "Generic fallback"].forEach(name => header.appendChild(el("th", "", name)));
  const thead = el("thead");
  thead.appendChild(header);
  table.appendChild(thead);
  const body = el("tbody");
  registry.forEach(item => {
    const row = el("tr");
    row.appendChild(el("td", "", item.language));
    row.appendChild(el("td", "", item.model));
    row.appendChild(el("td", "", `${item.sourceRepo} (${item.license})`));
    const status = el("td", item.installed ? "is-installed" : "is-missing", item.installed === null ? "n/a" : item.installed ? "Installed" : `Not installed: ${item.setup}`);
    row.appendChild(status);
    row.appendChild(el("td", item.genericFallback ? "" : "is-disabled", item.genericFallback ? "Allowed" : "Disabled"));
    body.appendChild(row);
  });
  table.appendChild(body);
  wrap.appendChild(table);
  return wrap;
}

function evaluationTable(evaluation) {
  const wrap = el("div", "flow-table-wrap");
  wrap.appendChild(el("h3", "flow-table-title", "Measured word error rate (lower is better)"));
  const table = el("table", "flow-table");
  const header = el("tr");
  ["Language", "Model", "WER %", "CER %", "Clips"].forEach(name => header.appendChild(el("th", "", name)));
  const thead = el("thead");
  thead.appendChild(header);
  table.appendChild(thead);
  const body = el("tbody");
  evaluation.results.forEach(item => {
    const row = el("tr");
    [item.language, item.model, String(item.WER), String(item.CER), String(item.clips)].forEach(value => row.appendChild(el("td", "", value)));
    body.appendChild(row);
  });
  table.appendChild(body);
  wrap.appendChild(table);
  wrap.appendChild(el("p", "nlp-note", `${evaluation.dataset}. ${evaluation.note}`));
  return wrap;
}

/* ---------------- Wiring ---------------- */

const panel = document.querySelector("#nlp-section");
const flow = document.querySelector("#flow-section");

if (panel) {
  document.addEventListener("nlp-analysis", event => {
    try { renderAnalysis(panel, event.detail); } catch { panel.hidden = true; }
  });
}

if (flow) {
  fetch("/api/nlp/pipeline")
    .then(response => (response.ok ? response.json() : Promise.reject(new Error("pipeline unavailable"))))
    .then(description => renderFlow(flow, description))
    .catch(() => { flow.hidden = true; });
}
