/**
 * Plain-language parsing for the morphology codes in the word data:
 * OpenScriptures Hebrew codes ("HVqp3ms", "HC/Vqw3ms", "HTd/Ncmpa") and
 * MorphGNT Greek codes ("V- 3AAI-S--", "N- ----DSF-"). Best effort: anything
 * unrecognised falls back to the raw code.
 */

const H_POS: Record<string, string> = { A: "adjective", C: "conjunction", D: "adverb", N: "noun", P: "pronoun", R: "preposition", S: "suffix", T: "particle", V: "verb" };
const H_STEM: Record<string, string> = { q: "qal", N: "niphal", p: "piel", P: "pual", h: "hiphil", H: "hophal", t: "hithpael", o: "polel", O: "polal", r: "hithpolel", m: "poel", M: "poal", k: "palel", K: "pulal", Q: "qal passive", l: "pilpel", L: "polpal", f: "hithpalpel", D: "nithpael", j: "pealal", i: "pilel", u: "hothpaal", c: "tiphil", v: "hishtaphel", w: "nithpalel", y: "nithpoel", z: "hithpoel" };
const H_VTYPE: Record<string, string> = { p: "perfect", q: "sequential perfect", i: "imperfect", w: "wayyiqtol (narrative past)", h: "cohortative", j: "jussive", v: "imperative", r: "participle, active", s: "participle, passive", a: "infinitive absolute", c: "infinitive construct" };
const H_NTYPE: Record<string, string> = { c: "common", g: "gentilic", p: "proper name" };
const H_PTYPE: Record<string, string> = { d: "demonstrative", f: "indefinite", i: "interrogative", p: "personal", r: "relative" };
const H_TTYPE: Record<string, string> = { a: "affirmation", d: "definite article", e: "exhortation", i: "interrogative", j: "interjection", m: "demonstrative", n: "negative", o: "direct object marker", r: "relative" };
const H_ATYPE: Record<string, string> = { a: "adjective", c: "cardinal number", g: "gentilic", o: "ordinal number" };
const H_STYPE: Record<string, string> = { d: "directional he", h: "paragogic he", n: "paragogic nun", p: "pronominal suffix" };
const GENDER: Record<string, string> = { m: "masculine", f: "feminine", b: "both", c: "common", n: "neuter" };
const NUMBER: Record<string, string> = { s: "singular", p: "plural", d: "dual" };
const H_STATE: Record<string, string> = { a: "absolute", c: "construct", d: "determined" };
const PERSON: Record<string, string> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };

function hebrewPart(code: string): string {
  const pos = code[0];
  const rest = code.slice(1);
  switch (pos) {
    case "V": {
      const [stem, type, a, b, c] = rest.split("");
      const bits = ["verb", H_STEM[stem], H_VTYPE[type]];
      if (type === "r" || type === "s") bits.push(GENDER[a], NUMBER[b], H_STATE[c]);
      else if (type !== "a" && type !== "c") bits.push(PERSON[a], GENDER[b], NUMBER[c]);
      return bits.filter(Boolean).join(", ");
    }
    case "N": {
      const [type, g, n, s] = rest.split("");
      return [type === "p" ? "proper noun" : `noun${H_NTYPE[type] ? `, ${H_NTYPE[type]}` : ""}`, GENDER[g], NUMBER[n], H_STATE[s]].filter(Boolean).join(", ");
    }
    case "A": {
      const [type, g, n, s] = rest.split("");
      return [H_ATYPE[type] ?? "adjective", GENDER[g], NUMBER[n], H_STATE[s]].filter(Boolean).join(", ");
    }
    case "P": {
      const [type, p, g, n] = rest.split("");
      return [`${H_PTYPE[type] ?? ""} pronoun`.trim(), PERSON[p], GENDER[g], NUMBER[n]].filter(Boolean).join(", ");
    }
    case "T":
      return H_TTYPE[rest[0]] ?? "particle";
    case "S": {
      const [type, p, g, n] = rest.split("");
      return [H_STYPE[type] ?? "suffix", PERSON[p], GENDER[g], NUMBER[n]].filter(Boolean).join(", ");
    }
    case "R":
      return rest[0] === "d" ? "preposition with article" : "preposition";
    default:
      return H_POS[pos] ?? code;
  }
}

export function describeHebrew(code: string): string {
  if (!code) return "";
  const lang = code[0] === "A" ? "Aramaic " : "";
  const parts = code.slice(1).split("/");
  // Prefixes (conjunction, preposition, article) precede the main word; suffixes follow it.
  let mainIdx = parts.findIndex((p) => !(p[0] === "C" || p[0] === "R" || (p[0] === "T" && p[1] === "d")));
  if (mainIdx < 0) mainIdx = parts.length - 1;
  const main = hebrewPart(parts[mainIdx]);
  const prefixes = parts.slice(0, mainIdx).map(hebrewPart);
  const suffixes = parts.slice(mainIdx + 1).map(hebrewPart);
  let out = `${lang}${main}`;
  if (suffixes.length) out += ` + ${suffixes.join(" + ")}`;
  if (prefixes.length) out += ` (prefixed ${prefixes.join(", ")})`;
  return out;
}

const G_POS: Record<string, string> = { "A-": "adjective", "C-": "conjunction", "D-": "adverb", "I-": "interjection", "N-": "noun", "P-": "preposition", "RA": "definite article", "RD": "demonstrative pronoun", "RI": "interrogative/indefinite pronoun", "RP": "personal pronoun", "RR": "relative pronoun", "V-": "verb", "X-": "particle" };
const G_TENSE: Record<string, string> = { P: "present", I: "imperfect", F: "future", A: "aorist", X: "perfect", Y: "pluperfect" };
const G_VOICE: Record<string, string> = { A: "active", M: "middle", P: "passive" };
const G_MOOD: Record<string, string> = { I: "indicative", D: "imperative", S: "subjunctive", O: "optative", N: "infinitive", P: "participle" };
const G_CASE: Record<string, string> = { N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" };
const G_DEGREE: Record<string, string> = { C: "comparative", S: "superlative" };

export function describeGreek(code: string): string {
  if (!code) return "";
  const [pos, parse = ""] = code.split(" ");
  const base = G_POS[pos] ?? pos;
  const [person, tense, voice, mood, kase, number, gender, degree] = parse.padEnd(8, "-").split("");
  const bits = [base];
  if (pos === "V-") {
    bits.push(G_TENSE[tense], G_VOICE[voice], G_MOOD[mood]);
    if (mood === "P") bits.push(G_CASE[kase], NUMBER[number.toLowerCase()], GENDER[gender.toLowerCase()]);
    else if (mood !== "N") bits.push(PERSON[person], NUMBER[number.toLowerCase()]);
  } else {
    bits.push(G_CASE[kase], NUMBER[number.toLowerCase()], GENDER[gender.toLowerCase()], G_DEGREE[degree]);
  }
  return bits.filter(Boolean).join(", ");
}

export function describeMorph(language: string, code: string): string {
  return language === "he" ? describeHebrew(code) : describeGreek(code);
}
