import type { Metadata } from "next";
import { Suspense } from "react";
import MyTestimonies from "@/components/MyTestimonies";

export const metadata: Metadata = { title: "My testimonies" };

export default function MePage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <p className="eyebrow mb-3">Your account</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50">My testimonies</h1>
      <div className="mt-10">
        <Suspense>
          <MyTestimonies />
        </Suspense>
      </div>
    </main>
  );
}
