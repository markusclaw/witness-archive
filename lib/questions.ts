/**
 * The questions the archive answers — through the testimonies of people who
 * lived them, not by declaring an answer. Each testimony can be tagged with up
 * to three of these slugs (testimonies.questions). Order here is display order.
 */

export interface QuestionRef {
  /** OSIS book code, lowercase (as in /bible/<book>/<chapter>). */
  book: string;
  chapter: number;
  verse?: string;
  label: string;
}

export interface Question {
  slug: string;
  /** The question as people ask it. */
  q: string;
  /** Shorter form for chips. */
  short: string;
  q_es: string;
  q_pt: string;
  /** Two or three sentences: what this page is and how to read it. */
  intro: string;
  /** For the tagger: what counts as speaking to this question. */
  tagHint: string;
  scripture: QuestionRef[];
  /** Pages that need extra care (crisis resources first, no AI summary). */
  sensitive?: boolean;
}

export const QUESTIONS: Question[] = [
  {
    slug: "what-happens-when-we-die",
    q: "What happens when we die?",
    short: "What happens when we die?",
    q_es: "¿Qué pasa cuando morimos?",
    q_pt: "O que acontece quando morremos?",
    intro:
      "People who were declared clinically dead, or who came close, often describe what they saw and felt in those minutes. These are their accounts in their own words — not a doctrine, but a record of what the people who went there report.",
    tagHint: "near-death and clinical-death experiences, out-of-body experiences, what the person saw or felt while dead or dying",
    scripture: [
      { book: "heb", chapter: 9, verse: "27", label: "Hebrews 9:27" },
      { book: "2cor", chapter: 5, verse: "6-8", label: "2 Corinthians 5:6–8" },
      { book: "luke", chapter: 23, verse: "43", label: "Luke 23:43" },
    ],
  },
  {
    slug: "is-hell-real",
    q: "Is hell real?",
    short: "Is hell real?",
    q_es: "¿Es real el infierno?",
    q_pt: "O inferno é real?",
    intro:
      "Some of the most sobering accounts in the archive come from people who say they were shown hell — in a near-death experience, a vision, or a dream — and returned with a warning. Read them as testimony: what each person says they saw, in their own words.",
    tagHint: "visions or experiences of hell, torment, the lake of fire, warnings about eternal judgment",
    scripture: [
      { book: "luke", chapter: 16, verse: "19-31", label: "Luke 16:19–31" },
      { book: "matt", chapter: 25, verse: "41-46", label: "Matthew 25:41–46" },
      { book: "rev", chapter: 20, verse: "11-15", label: "Revelation 20:11–15" },
    ],
  },
  {
    slug: "what-is-heaven-like",
    q: "What is heaven like?",
    short: "What is heaven like?",
    q_es: "¿Cómo es el cielo?",
    q_pt: "Como é o céu?",
    intro:
      "Light, peace, music, loved ones, a presence that words fail to describe — people who say they glimpsed heaven tend to return to the same few images. These are their descriptions, collected so they can be read side by side.",
    tagHint: "visions or experiences of heaven, paradise, meeting loved ones or Jesus in heaven",
    scripture: [
      { book: "rev", chapter: 21, verse: "1-4", label: "Revelation 21:1–4" },
      { book: "john", chapter: 14, verse: "1-3", label: "John 14:1–3" },
      { book: "2cor", chapter: 12, verse: "2-4", label: "2 Corinthians 12:2–4" },
    ],
  },
  {
    slug: "does-god-still-heal",
    q: "Does God still heal today?",
    short: "Does God still heal?",
    q_es: "¿Dios todavía sana hoy?",
    q_pt: "Deus ainda cura hoje?",
    intro:
      "Recoveries doctors could not explain, sudden healings after prayer, and slower restorations people credit to God. The archive records what each person says happened to them; where they mention doctors, diagnoses or dates, those details are kept.",
    tagHint: "physical or mental healing the person attributes to God or prayer, miraculous recovery",
    scripture: [
      { book: "jas", chapter: 5, verse: "14-16", label: "James 5:14–16" },
      { book: "mark", chapter: 16, verse: "17-18", label: "Mark 16:17–18" },
      { book: "acts", chapter: 3, verse: "1-10", label: "Acts 3:1–10" },
    ],
  },
  {
    slug: "are-angels-real",
    q: "Are angels real?",
    short: "Are angels real?",
    q_es: "¿Existen los ángeles?",
    q_pt: "Os anjos existem?",
    intro:
      "Rescues by strangers who then vanished, beings of light at a hospital bed, protection in moments that should have ended in death. These are first-hand accounts of people who believe they met an angel.",
    tagHint: "encounters with angels, angelic protection or rescue, guardian angels",
    scripture: [
      { book: "heb", chapter: 13, verse: "2", label: "Hebrews 13:2" },
      { book: "ps", chapter: 91, verse: "11-12", label: "Psalm 91:11–12" },
      { book: "heb", chapter: 1, verse: "14", label: "Hebrews 1:14" },
    ],
  },
  {
    slug: "are-demons-real",
    q: "Are demons real — and can people be set free?",
    short: "Are demons real?",
    q_es: "¿Existen los demonios, y se puede ser libre?",
    q_pt: "Os demônios existem, e é possível ser liberto?",
    intro:
      "Accounts of spiritual oppression, possession and deliverance — told by the people who say they were bound and set free, and by those who prayed for them. They describe what they experienced and what changed afterwards.",
    tagHint: "demonic oppression or possession, spiritual warfare, deliverance, being set free from spirits",
    scripture: [
      { book: "mark", chapter: 5, verse: "1-20", label: "Mark 5:1–20" },
      { book: "eph", chapter: 6, verse: "10-18", label: "Ephesians 6:10–18" },
      { book: "luke", chapter: 10, verse: "17-20", label: "Luke 10:17–20" },
    ],
  },
  {
    slug: "is-witchcraft-real",
    q: "Is witchcraft and the occult real?",
    short: "Is the occult real?",
    q_es: "¿Es real la brujería y lo oculto?",
    q_pt: "A bruxaria e o ocultismo são reais?",
    intro:
      "Former witches, occultists and members of secret societies describe what they practised, what they believe was behind it, and how they left. Their claims are their own; the archive keeps them as told.",
    tagHint: "former witches, occultists, satanists, marine kingdom, secret societies, sorcery, curses — told by someone who was involved or affected",
    scripture: [
      { book: "deut", chapter: 18, verse: "10-12", label: "Deuteronomy 18:10–12" },
      { book: "acts", chapter: 19, verse: "18-20", label: "Acts 19:18–20" },
      { book: "gal", chapter: 5, verse: "19-21", label: "Galatians 5:19–21" },
    ],
  },
  {
    slug: "does-god-speak-in-dreams",
    q: "Does God speak through dreams and visions?",
    short: "Does God speak in dreams?",
    q_es: "¿Dios habla por sueños y visiones?",
    q_pt: "Deus fala por sonhos e visões?",
    intro:
      "Dreams that would not leave, visions in prayer, a voice heard at a turning point. People share what they saw or heard, what they believe it meant, and — where they can — what happened afterwards.",
    tagHint: "dreams, visions, prophetic words or a voice the person believes came from God",
    scripture: [
      { book: "joel", chapter: 2, verse: "28-29", label: "Joel 2:28–29" },
      { book: "acts", chapter: 2, verse: "17", label: "Acts 2:17" },
      { book: "job", chapter: 33, verse: "14-16", label: "Job 33:14–16" },
    ],
  },
  {
    slug: "is-jesus-real",
    q: "Is Jesus who he said he was?",
    short: "Is Jesus real?",
    q_es: "¿Es Jesús quien dijo ser?",
    q_pt: "Jesus é quem disse ser?",
    intro:
      "Many testimonies turn on a single moment: an encounter with Jesus — in a vision, at the edge of death, or in an ordinary room. People from other faiths and from no faith describe meeting him and what it changed.",
    tagHint: "encounters with Jesus, conversions, people from other religions or atheism meeting Christ",
    scripture: [
      { book: "john", chapter: 14, verse: "6", label: "John 14:6" },
      { book: "john", chapter: 20, verse: "24-29", label: "John 20:24–29" },
      { book: "acts", chapter: 9, verse: "1-9", label: "Acts 9:1–9" },
    ],
  },
  {
    slug: "what-about-suicide",
    q: "What happens to those who take their own life?",
    short: "What about suicide?",
    q_es: "¿Qué pasa con quienes se quitan la vida?",
    q_pt: "O que acontece com quem tira a própria vida?",
    intro:
      "Some people in the archive survived a suicide attempt and describe what they experienced; others share what they believe they were shown. If you are reading this because you are hurting, please reach out to someone before you read on — you deserve support from a real person, today.",
    tagHint: "suicide, suicide attempts, survivors, visions about people who died by suicide",
    scripture: [
      { book: "ps", chapter: 34, verse: "18", label: "Psalm 34:18" },
      { book: "matt", chapter: 11, verse: "28-30", label: "Matthew 11:28–30" },
      { book: "rom", chapter: 8, verse: "38-39", label: "Romans 8:38–39" },
    ],
    sensitive: true,
  },
  {
    slug: "is-the-end-near",
    q: "Is the end of the world near?",
    short: "Is the end near?",
    q_es: "¿Está cerca el fin del mundo?",
    q_pt: "O fim do mundo está próximo?",
    intro:
      "Dreams of the rapture, visions of tribulation, warnings to be ready. These are what people say they were shown about the last days. The archive records the claims; it does not endorse dates or predictions.",
    tagHint: "end times, rapture, tribulation, mark of the beast, prophetic warnings about the future",
    scripture: [
      { book: "matt", chapter: 24, verse: "36-44", label: "Matthew 24:36–44" },
      { book: "1thess", chapter: 4, verse: "16-18", label: "1 Thessalonians 4:16–18" },
      { book: "1thess", chapter: 5, verse: "1-6", label: "1 Thessalonians 5:1–6" },
    ],
  },
  {
    slug: "is-god-real",
    q: "How can I know God is real?",
    short: "Is God real?",
    q_es: "¿Cómo puedo saber que Dios es real?",
    q_pt: "Como posso saber que Deus é real?",
    intro:
      "Skeptics, atheists and seekers describe the experience that changed their mind — or the slow accumulation of answered prayers that did. None of it is proof on its own; together it is a record worth reading.",
    tagHint: "people who doubted or did not believe and came to believe, answered prayer as evidence, encounters that convinced a skeptic",
    scripture: [
      { book: "jer", chapter: 29, verse: "13", label: "Jeremiah 29:13" },
      { book: "rom", chapter: 1, verse: "20", label: "Romans 1:20" },
      { book: "heb", chapter: 11, verse: "6", label: "Hebrews 11:6" },
    ],
  },
];

export function questionBySlug(slug: string | null | undefined): Question | undefined {
  return QUESTIONS.find((q) => q.slug === slug);
}

export function questionPath(slug: string): string {
  return `/questions/${slug}`;
}

/** The question in a reader language (falls back to English). */
export function questionText(q: Question, lang: string): string {
  return lang === "es" ? q.q_es : lang === "pt" ? q.q_pt : q.q;
}

export function scriptureHref(r: QuestionRef): string {
  const v = r.verse ? `?v=${r.verse.replace(/[–—]/g, "-")}` : "";
  return `/bible/${r.book}/${r.chapter}${v}`;
}

export const QUESTION_SLUGS = QUESTIONS.map((q) => q.slug);
