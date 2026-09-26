/**
 * Pick a short list of usable speech-synthesis voices for a language.
 * Operating systems ship dozens of voices, many of them novelty ("Bubbles",
 * "Bad News", "Organ"), so we score and keep only the few worth offering.
 */
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|organ|pipe organ|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelly|shelley|rishi)\b/i;

const PREMIUM = /\b(premium|enhanced|natural|neural|siri|online|wavenet|studio|journey)\b/i;

/** Known good defaults per platform, in preference order. */
const FAVORITES: Record<string, RegExp[]> = {
  en: [/^google (us|uk) english/i, /samantha/i, /\bava\b/i, /\balex\b/i, /daniel/i, /karen/i, /moira/i, /tessa/i, /google (us|uk) english/i, /microsoft (aria|jenny|guy|ryan|sonia)/i],
  es: [/^google español/i, /m[oó]nica/i, /paulina/i, /jorge/i, /juan/i, /google español/i, /microsoft (elvira|alvaro|dalia|jorge)/i],
  pt: [/^google português/i, /luciana/i, /joana/i, /felipe/i, /google português/i, /microsoft (francisca|antonio|raquel)/i],
};

export function selectVoices(all: SpeechSynthesisVoice[], lang: string, max = 4): SpeechSynthesisVoice[] {
  const prefix = lang.toLowerCase();
  const candidates = all.filter((v) => v.lang.toLowerCase().startsWith(prefix) && !NOVELTY.test(v.name.trim()));
  const favs = FAVORITES[prefix] ?? [];

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    const fi = favs.findIndex((re) => re.test(v.name));
    if (fi >= 0) s += 100 - fi;
    if (PREMIUM.test(v.name)) s += 40;
    if (v.localService) s += 5; // no network needed
    if (v.default) s += 3;
    return s;
  };

  // De-duplicate by display name (macOS lists the same voice per locale).
  const seen = new Set<string>();
  return candidates
    .map((v) => ({ v, s: score(v) }))
    .sort((a, b) => b.s - a.s)
    .filter(({ v }) => {
      const key = v.name.replace(/\s*\(.*?\)\s*/g, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max)
    .map(({ v }) => v);
}

/** "Samantha (English (United States))" -> "Samantha" */
export function voiceLabel(v: SpeechSynthesisVoice): string {
  return v.name.replace(/\s*\((English|Español|Spanish|Português|Portuguese)[^)]*\)\s*/i, "").trim();
}

/** The one voice we use for a language: Google's when the browser has it, otherwise the best local one. */
export function pickVoice(all: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  return selectVoices(all, lang, 1)[0];
}
