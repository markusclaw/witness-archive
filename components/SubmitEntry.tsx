"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TestimonyEditor from "@/components/TestimonyEditor";

/**
 * /submit?series=<series_id> opens the editor as "add the next part" of one
 * of the member's own series; otherwise it's a fresh testimony.
 */
export default function SubmitEntry() {
  const params = useSearchParams();
  const seriesId = params.get("series");
  const [ready, setReady] = useState(!seriesId);
  const [cont, setCont] = useState<React.ComponentProps<typeof TestimonyEditor>["continueSeries"]>(undefined);

  useEffect(() => {
    if (!seriesId) return;
    supabase
      .from("testimonies")
      .select("series_id, title, part_number, category, creator, is_anonymous, author_bio")
      .eq("series_id", seriesId)
      .order("part_number", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCont({
            series_id: data.series_id,
            title: data.title.replace(/\s*[—-]\s*Part \d+$/i, ""),
            nextPart: data.part_number + 1,
            category: data.category,
            creator: data.creator,
            is_anonymous: data.is_anonymous,
            author_bio: data.author_bio,
          });
        }
        setReady(true);
      });
  }, [seriesId]);

  if (!ready) return null;
  return <TestimonyEditor continueSeries={cont} />;
}
