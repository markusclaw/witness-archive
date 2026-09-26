import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">Witness Archive</h1>
          <p className="text-xl text-slate-300 mb-8">
            A curated collection of life-changing testimonies from people who have experienced the supernatural.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/archive"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Browse Testimonies
            </Link>
            <Link
              href="/auth"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-slate-700/50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-3">Curated Stories</h3>
            <p className="text-slate-300">
              Hand-selected testimonies from people who have genuinely encountered the supernatural and the divine.
            </p>
          </div>
          <div className="bg-slate-700/50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-3">Community Discussions</h3>
            <p className="text-slate-300">
              Join conversations, ask questions, and engage with others in our community of seekers and believers.
            </p>
          </div>
          <div className="bg-slate-700/50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-3">Accessible Archive</h3>
            <p className="text-slate-300">
              No more hunting for scattered videos. Find meaningful testimonies in one organized, searchable place.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
