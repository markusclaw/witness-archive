import type { Metadata } from "next";
import MyNotes from "@/components/MyNotes";

export const metadata: Metadata = {
  title: "My notes — The Bible",
  robots: { index: false, follow: false },
};

export default function MyNotesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <MyNotes />
    </main>
  );
}
