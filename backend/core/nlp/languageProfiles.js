// Per-language NLP resources. Each language keeps its own script, sentence rules, stop-words, suffix rules and
// legal gazetteer in one profile, so supporting a language means adding a profile, not touching the pipeline.
//
// Honest scope: these are small, hand-curated resources for a legal-query domain, not full linguistic models.
//   - stop-words are function words; negations are kept apart because "not"/"without" change legal meaning
//   - stemming is light rule-based suffix stripping; there is no lemmatizer for any of these languages
//   - the gazetteer covers common offence terms and law names; it does not cover persons or places

const words = text => new Set(text.split(/\s+/).filter(Boolean));

export const SCRIPTS = {
  devanagari: /[ऀ-ॿ]/u,
  gujarati: /[઀-૿]/u,
  arabic: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/u,
  latin: /[A-Za-z]/u
};

const HINDI_STOP = words(`अपना अपनी अपने आप इन इनका इस इसका इसकी इसके इसमें इसी इसे उन उनका उनकी उनके उनको उस उसके उसी उसे एक एवं और कई कर करता
  करते करना करने करें कहा का कि किया किस किसी किसे की कुछ कुल के को कोई कौन गया जब जहाँ जहां जा जिन जिस जिसे जैसा जैसे जो तक तब तरह तो था थी थे दो द्वारा
  ने पर पहले फिर बहुत बाद भी मगर में यदि यह यहाँ यहां यही या ये रहा रही रहे लिए लिये लेकिन वह वहाँ वहां वही वे सकता सकते सबसे सभी साथ से सो ही हुआ हुई हुए
  है हैं हो होता होती होते होना होने मैं मुझे मुझको मेरा मेरी मेरे हम हमारा हमारी हमारे तुम तुम्हारा आपका आपकी आपके कैसे क्या क्यों कब कहाँ`);
const HINDI_NEG = words("नहीं न मत बिना");

const MARATHI_STOP = words(`आणि आहे आहेत होता होती होते मध्ये ने ला चा ची चे च्या ना हा ही हे तो ती ते या त्या एक पण की जे जर तर वर साठी सह मी आम्ही तुम्ही
  माझा माझी माझे माझ्या झाला झाली झाले केला केली केले त्याने तिने त्याचा त्याची त्याचे आता तेव्हा जेव्हा काही कोणी हे`);
const MARATHI_NEG = words("नाही न नको शिवाय");

const GUJARATI_STOP = words(`અને છે હતો હતી હતું હતા માં થી ને નો ની નું ના એક આ તે એ પણ કે જે જો તો પર સાથે માટે થયું થયો થઈ થયા કર્યું કરી કરવા કરે હું અમે તમે
  મારો મારી મારું મારા તેના તેની તેનું તેણે ત્યારે જ્યારે હવે ફક્ત વધુ ખૂબ કોઈ કંઈ છું છીએ છો તેમ તેમાં આમાં`);
const GUJARATI_NEG = words("નથી ન નહીં વગર");

const URDU_STOP = words(`اور کا کی کے کو میں سے پر ہے ہیں تھا تھی تھے ہو ہوا ہوئی ہوئے نے کہ یہ وہ ان اس ایک بھی تو یا لیے لئے ساتھ کر کیا کرنے کرتا کرتے
  گیا گئی گئے رہا رہی رہے سکتا ہم میرا میری میرے آپ تم اپنا اپنی اپنے جو جب تک بعد پہلے کوئی کچھ بہت ہی ہوں تھیں ہوتا ہوتی ہوتے`);
const URDU_NEG = words("نہیں نہ بغیر");

const ENGLISH_STOP = words(`the a an and or of to in on at by for with from is are was were be been it this that these those as i my me we our you your he she
  they his her their its under which who whom his him them has have had do does did will would can could may might shall should there here`);
const ENGLISH_NEG = words("not no without never none nor cannot");

// Common Indian-script spellings of the months are produced from Intl at load time (see entities.js).
export const PROFILES = {
  hi: {
    code: "hi", name: "Hindi", script: "devanagari", rtl: false, locale: "hi-IN",
    stopwords: HINDI_STOP, negations: HINDI_NEG,
    // Longest suffix first. Applied only when at least two characters remain.
    suffixes: ["ाइयों", "ाइयाँ", "ियों", "ियाँ", "ाओं", "ाएँ", "ाएं", "ाना", "ाने", "ाता", "ाते", "ाती", "ाया", "ाई", "ाए", "ीय", "ें", "ों", "ीं", "ाँ", "ां", "ो", "े", "ी", "ा", "ि"],
    sectionWords: ["धारा"], moneyWords: ["रुपये", "रुपए", "रूपये", "रुपया", "रु", "रू"],
    lawNames: [["भारतीय दंड संहिता", "IPC"], ["भारतीय न्याय संहिता", "BNS"], ["दंड प्रक्रिया संहिता", "CrPC"]],
    offences: [["चोरी", "theft"], ["धोखाधड़ी", "cheating"], ["ठगी", "cheating"], ["लूट", "robbery"], ["डकैती", "dacoity"], ["हत्या", "murder"], ["खून", "murder"],
      ["मारपीट", "hurt"], ["अपहरण", "kidnapping"], ["जबरन वसूली", "extortion"], ["धमकी", "criminal intimidation"], ["मानहानि", "defamation"], ["जालसाजी", "forgery"]]
  },
  mr: {
    code: "mr", name: "Marathi", script: "devanagari", rtl: false, locale: "mr-IN",
    stopwords: MARATHI_STOP, negations: MARATHI_NEG,
    suffixes: ["ांमध्ये", "ांच्या", "ाच्या", "ांचा", "ांची", "ांचे", "ाचा", "ाची", "ाचे", "ांना", "ांनी", "ाला", "ाने", "ांत", "ात", "ा", "ी", "े"],
    sectionWords: ["कलम", "धारा"], moneyWords: ["रुपये", "रुपया", "रु"],
    lawNames: [["भारतीय दंड संहिता", "IPC"], ["भारतीय न्याय संहिता", "BNS"]],
    offences: [["चोरी", "theft"], ["फसवणूक", "cheating"], ["लूट", "robbery"], ["दरोडा", "dacoity"], ["हत्या", "murder"], ["खून", "murder"], ["मारहाण", "hurt"],
      ["अपहरण", "kidnapping"], ["खंडणी", "extortion"], ["धमकी", "criminal intimidation"], ["बदनामी", "defamation"]]
  },
  gu: {
    code: "gu", name: "Gujarati", script: "gujarati", rtl: false, locale: "gu-IN",
    stopwords: GUJARATI_STOP, negations: GUJARATI_NEG,
    suffixes: ["ોમાં", "ોને", "ોનો", "ોની", "ોનું", "ોથી", "ોના", "માં", "ને", "થી", "નો", "ની", "નું", "ના", "ો", "ી", "ું", "ે", "ા"],
    sectionWords: ["કલમ", "દફા"], moneyWords: ["રૂપિયા", "રૂપિયો", "રૂ"],
    lawNames: [["ભારતીય દંડ સંહિતા", "IPC"], ["ભારતીય ન્યાય સંહિતા", "BNS"]],
    offences: [["ચોરી", "theft"], ["છેતરપિંડી", "cheating"], ["લૂંટ", "robbery"], ["ધાડ", "dacoity"], ["હત્યા", "murder"], ["અપહરણ", "kidnapping"],
      ["ખંડણી", "extortion"], ["ધમકી", "criminal intimidation"], ["માનહાનિ", "defamation"], ["મારપીટ", "hurt"]]
  },
  ur: {
    code: "ur", name: "Urdu", script: "arabic", rtl: true, locale: "ur-PK",
    stopwords: URDU_STOP, negations: URDU_NEG,
    suffixes: ["یاں", "وں", "یں", "ات", "ان", "ی", "ے", "ا"],
    sectionWords: ["دفعہ", "دفعه"], moneyWords: ["روپے", "روپیہ", "روپیے"],
    lawNames: [["مجموعہ تعزیرات", "IPC"], ["بھارتیہ نیائے سنہتا", "BNS"]],
    offences: [["چوری", "theft"], ["دھوکہ دہی", "cheating"], ["فراڈ", "cheating"], ["ڈکیتی", "dacoity"], ["لوٹ", "robbery"], ["قتل", "murder"], ["اغوا", "kidnapping"],
      ["بھتہ", "extortion"], ["دھمکی", "criminal intimidation"], ["ہتک عزت", "defamation"], ["مار پیٹ", "hurt"]]
  },
  en: {
    code: "en", name: "English", script: "latin", rtl: false, locale: "en-IN",
    stopwords: ENGLISH_STOP, negations: ENGLISH_NEG,
    suffixes: ["ing", "edly", "ed", "es", "s"],
    sectionWords: ["section", "sections", "sec"], moneyWords: ["rupees", "rupee", "rs", "inr"],
    lawNames: [["Indian Penal Code", "IPC"], ["Bharatiya Nyaya Sanhita", "BNS"], ["Code of Criminal Procedure", "CrPC"]],
    offences: [["theft", "theft"], ["cheating", "cheating"], ["robbery", "robbery"], ["dacoity", "dacoity"], ["murder", "murder"], ["extortion", "extortion"],
      ["kidnapping", "kidnapping"], ["defamation", "defamation"], ["forgery", "forgery"], ["criminal intimidation", "criminal intimidation"]]
  }
};

export function getProfile(code) {
  return PROFILES[String(code || "").toLowerCase().split("-")[0]] || null;
}

// Language selection when none is supplied: script decides, and ambiguous scripts say so instead of guessing.
export function inferLanguageFromScript(text) {
  const has = name => SCRIPTS[name].test(text);
  if (has("gujarati")) return { language: "gu", confidence: "script", ambiguous: false };
  if (has("arabic")) return { language: "ur", confidence: "script", ambiguous: false };
  if (has("devanagari")) return { language: "hi", confidence: "script", ambiguous: true, alternatives: ["mr"] };
  if (has("latin")) return { language: "en", confidence: "script", ambiguous: false };
  return { language: null, confidence: "none", ambiguous: false };
}
