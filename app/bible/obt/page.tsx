import type { Metadata } from "next";
import EditionHome from "@/components/edition/EditionHome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Bible Translation",
  description: "An open English Bible translated directly from the Hebrew and Greek — draft in progress.",
  // In progress: shared by link, not listed in search engines yet.
  robots: { index: false, follow: false },
};

export default function ObtHomePage() {
  return <EditionHome edition="obt" />;
}
