import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AuthNav from "@/components/AuthNav";

export const metadata: Metadata = {
  title: "Witness Archive - Testimonies of the Supernatural",
  description: "A curated collection of life-changing testimonies from people who have experienced the supernatural.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">
        {/* Navigation */}
        <nav className="bg-slate-900/80 backdrop-blur border-b border-slate-700">
          <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold">
              Witness Archive
            </Link>
            <ul className="flex gap-6">
              <li>
                <Link href="/archive" className="hover:text-blue-400 transition">
                  Archive
                </Link>
              </li>
              <li>
                <AuthNav />
              </li>
            </ul>
          </div>
        </nav>

        {/* Main content */}
        {children}

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-700 mt-20 py-8">
          <div className="max-w-5xl mx-auto px-6 text-center text-slate-400">
            <p>&copy; 2026 Witness Archive. All testimonies are shared with permission.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
