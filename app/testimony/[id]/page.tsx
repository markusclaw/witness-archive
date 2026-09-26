"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Comments from "@/components/Comments";

interface Testimony {
  id: string;
  title: string;
  description: string;
  video_url: string;
  creator: string;
  created_at: string;
  category: string;
  content: string;
}

export default function TestimonyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [testimony, setTestimony] = useState<Testimony | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTestimony = async () => {
      const { data, error } = await supabase
        .from("testimonies")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching testimony:", error);
      } else {
        setTestimony(data);
      }
      setLoading(false);
    };

    fetchTestimony();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <p className="text-slate-300">Loading testimony...</p>
        </div>
      </main>
    );
  }

  if (!testimony) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <p className="text-slate-300">Testimony not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Testimony Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            {testimony.title}
          </h1>
          <div className="flex gap-4 items-center text-slate-400 text-sm mb-6">
            <span>by {testimony.creator}</span>
            <span>•</span>
            <span>
              {new Date(testimony.created_at).toLocaleDateString()}
            </span>
            <span>•</span>
            <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded">
              {testimony.category}
            </span>
          </div>
          <p className="text-lg text-slate-300 mb-8">{testimony.description}</p>
        </div>

        {/* Video */}
        {testimony.video_url && (
          <div className="mb-12">
            <div className="aspect-video bg-slate-800 rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src={testimony.video_url.replace(
                  "youtube.com/watch?v=",
                  "youtube.com/embed/"
                )}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}

        {/* Content */}
        {testimony.content && (
          <div className="mb-12 prose prose-invert max-w-none">
            <div className="text-slate-300 whitespace-pre-wrap">
              {testimony.content}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="border-t border-slate-700 pt-12">
          <h2 className="text-2xl font-bold text-white mb-8">Comments</h2>
          <Comments testimonyId={id} />
        </div>
      </div>
    </main>
  );
}
