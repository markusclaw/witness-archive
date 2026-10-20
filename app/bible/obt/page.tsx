import type { Metadata } from "next";
import EditionHome from "@/components/edition/EditionHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ruth — Open Bible Translation",
  description: "The book of Ruth in the Open Bible Translation, an open English translation made directly from the Hebrew.",
  // In progress: shared by link, not listed in search engines yet.
  robots: { index: false, follow: false },
};

export default function ObtHomePage() {
  return <EditionHome edition="obt" />;
}
