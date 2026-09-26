import type { Metadata } from "next";
import SubmitForm from "@/components/SubmitForm";

export const metadata: Metadata = {
  title: "Submit a testimony",
  description: "Share a first-hand testimony with the Witness Archive. Every submission is reviewed by a person.",
};

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow mb-3">Submissions</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">
        Share what happened to you.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-parchment-300">
        Submit your own testimony, or one you&apos;ve found that deserves to be preserved. A video link, a
        written account, or both. Everything is read by a real person before it is published, and we&apos;ll
        help tidy up the formatting — you don&apos;t need to make it perfect.
      </p>
      <div className="mt-10">
        <SubmitForm />
      </div>
    </main>
  );
}
