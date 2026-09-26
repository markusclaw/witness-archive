import type { Metadata } from "next";
import TestimonyArticle, { testimonyMetadata } from "@/components/TestimonyArticle";
import { getTestimonyById } from "@/lib/queries";
import { parseTestimonyParam } from "@/lib/seo";
import { DEFAULT_LANGUAGE } from "@/lib/languages";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** The unprefixed URL always shows the testimony in its original language. */
async function originalLanguage(param: string): Promise<string> {
  const parsed = parseTestimonyParam(param);
  const t = parsed ? await getTestimonyById(parsed.id) : null;
  return t?.language ?? DEFAULT_LANGUAGE;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return testimonyMetadata(id, await originalLanguage(id));
}

export default async function TestimonyPage({ params }: { params: Params }) {
  const { id } = await params;
  return <TestimonyArticle param={id} lang={await originalLanguage(id)} />;
}
