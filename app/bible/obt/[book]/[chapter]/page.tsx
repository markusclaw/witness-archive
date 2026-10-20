import type { Metadata } from "next";
import EditionReview, { reviewMetadata } from "@/components/edition/EditionReview";

export const dynamic = "force-dynamic";

type Params = Promise<{ book: string; chapter: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  return reviewMetadata("obt", p.book, p.chapter);
}

export default function Page({ params }: { params: Params }) {
  return <EditionReview edition="obt" params={params} />;
}
