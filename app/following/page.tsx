import type { Metadata } from "next";
import FollowingFeed from "@/components/FollowingFeed";

export const metadata: Metadata = { title: "Following", robots: { index: false, follow: false } };

export default function FollowingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow mb-3">Your feed</p>
      <h1 className="font-display text-4xl font-light text-parchment-50">From people you follow</h1>
      <div className="mt-10">
        <FollowingFeed />
      </div>
    </main>
  );
}
