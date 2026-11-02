import { createServerSupabase } from "@/lib/supabase-server";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import type { Testimony } from "@/lib/types";
import type { Pattern } from "@/lib/ai/questions";

/** How many published testimonies speak to each question. Empty if migration 031 isn't applied yet. */
export async function getQuestionCounts(): Promise<Record<string, number>> {
  const { data, error } = await createServerSupabase().from("testimonies").select("questions").eq("status", "published").not("questions", "is", null);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const r of data ?? []) for (const s of (r.questions as string[] | null) ?? []) counts[s] = (counts[s] ?? 0) + 1;
  return counts;
}

export async function getTestimoniesForQuestion(slug: string, limit = 60): Promise<Testimony[]> {
  const { data, error } = await createServerSupabase()
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("status", "published")
    .contains("questions", [slug])
    .order("view_count", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Testimony[];
}

export interface QuestionSummary {
  patterns: Pattern[];
  testimony_count: number;
  generated_at: string;
}

export async function getQuestionSummary(slug: string): Promise<QuestionSummary | null> {
  const { data, error } = await createServerSupabase().from("question_summaries").select("patterns, testimony_count, generated_at").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return data as QuestionSummary;
}

/** The question slugs a testimony is tagged with (empty when untagged or before migration 031). */
export async function getTestimonyQuestions(id: string): Promise<string[]> {
  const { data, error } = await createServerSupabase().from("testimonies").select("questions").eq("id", id).maybeSingle();
  if (error || !data) return [];
  return (data.questions as string[] | null) ?? [];
}
