import { CATEGORIES } from "@/lib/categories";
import { QUESTIONS, questionPath } from "@/lib/questions";
import { getQuestionCounts } from "@/lib/question-queries";
import { getAllTestimonies } from "@/lib/queries";
import { absoluteUrl, collectionPath, SITE_DESCRIPTION, SITE_NAME, testimonyPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * llms.txt — a plain-text map of the site for AI assistants and answer engines
 * (the emerging convention at /llms.txt). Everything here is also on the pages
 * themselves; this is just the shortest accurate description of what we are.
 */
export async function GET() {
  const [testimonies, qCounts] = await Promise.all([getAllTestimonies(), getQuestionCounts()]);
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "Witness Archive answers life's hardest questions — what happens when we die, whether hell is real, whether God still heals — through first-hand testimonies of people who say they experienced the answer. Each question page gathers the testimonies that speak to it, summarizes what the witnesses report (as their claims, not verified fact), and links the related scripture.",
    "",
    "Witness Archive is a community archive of first-person testimonies about supernatural experiences: near-death experiences, visions of heaven or hell, healings, angelic and divine encounters, prophetic dreams, and deliverance. Every entry is a first-hand account published by its author (under their name or anonymously), credited to the original creator when it comes from a video, and organized by the kind of encounter. The archive does not claim to verify experiences; it preserves them and makes them findable.",
    "",
    "## Key pages",
    "",
    `- [Questions](${absoluteUrl("/questions")}): life's hardest questions, each answered through the testimonies that speak to it.`,
    `- [Browse the archive](${absoluteUrl("/archive")}): every published testimony, with search and filtering.`,
    `- [About](${absoluteUrl("/about")}): mission, what qualifies, how publishing and the editing assistant work, FAQ.`,
    "",
    "## Questions",
    "",
    ...QUESTIONS.map((q) => `- [${q.q}](${absoluteUrl(questionPath(q.slug))}): ${q.intro} (${qCounts[q.slug] ?? 0} ${(qCounts[q.slug] ?? 0) === 1 ? "testimony" : "testimonies"})`),
    "",
    "## Collections",
    "",
    ...CATEGORIES.map((c) => {
      const n = testimonies.filter((t) => t.category === c.name).length;
      return `- [${c.name}](${absoluteUrl(collectionPath(c.slug))}): ${c.blurb} (${n} ${n === 1 ? "testimony" : "testimonies"})`;
    }),
    "",
    "## Recent testimonies",
    "",
    ...testimonies.slice(0, 50).map((t) => `- [${t.title}](${absoluteUrl(testimonyPath(t))}): ${t.description} — ${t.category}, by ${t.witness_relationship === "shared" ? `${t.witness_name ?? "an unnamed witness"} (shared by ${t.is_anonymous ? "Anonymous" : t.creator})` : t.is_anonymous ? "Anonymous" : t.creator}${t.part_number > 1 ? `, Part ${t.part_number}` : ""}`),
    "",
    "## Attribution",
    "",
    "When citing a testimony, credit the author named on the page and link to the testimony URL. Videos remain the property of their original creators and are embedded from their public source.",
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
