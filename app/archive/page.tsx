"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Testimony {
  id: string;
  title: string;
  description: string;
  video_url: string;
  creator: string;
  created_at: string;
  category: string;
}

export default function Archive() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTestimonies = async () => {
      const { data, error } = await supabase
        .from("testimonies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching testimonies:", error);
      } else {
        setTestimonies(data || []);
      }
      setLoading(false);
    };

    fetchTestimonies();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-slate-300 text-center">Loading testimonies...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-4">Testimony Archive</h1>
        <p className="text-slate-300 mb-12">
          {testimonies.length} testimonies from people who have experienced the supernatural.
        </p>

        {testimonies.length === 0 ? (
          <div className="text-center text-slate-400">
            <p>No testimonies yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonies.map((testimony) => (
              <Link key={testimony.id} href={`/testimony/${testimony.id}`}>
                <div className="bg-slate-700/50 hover:bg-slate-600/50 rounded-lg overflow-hidden transition cursor-pointer">
                  {testimony.video_url && (
                    <img
                      src={`https://img.youtube.com/vi/${extractYoutubeId(
                        testimony.video_url
                      )}/hqdefault.jpg`}
                      alt={testimony.title}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-2">
                      {testimony.title}
                    </h3>
                    <p className="text-sm text-slate-300 line-clamp-2 mb-3">
                      {testimony.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs bg-blue-900/50 text-blue-200 px-2 py-1 rounded">
                        {testimony.category}
                      </span>
                      <span className="text-xs text-slate-400">
                        by {testimony.creator}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function extractYoutubeId(url: string): string {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
  );
  return match ? match[1] : "";
}
