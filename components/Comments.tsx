"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  user_id: string;
}

export default function Comments({ testimonyId }: { testimonyId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    checkUser();

    // Fetch existing comments
    const fetchComments = async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("testimony_id", testimonyId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching comments:", error);
      } else {
        setComments(data || []);
      }
    };

    fetchComments();
  }, [testimonyId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to comment");
      return;
    }

    if (!newComment.trim()) return;

    setLoading(true);

    try {
      const { error } = await supabase.from("comments").insert([
        {
          testimony_id: testimonyId,
          user_id: user.id,
          author: user.email,
          content: newComment,
        },
      ]);

      if (error) throw error;

      setNewComment("");
      // Refresh comments
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("testimony_id", testimonyId)
        .order("created_at", { ascending: true });

      setComments(data || []);
    } catch (err) {
      console.error("Error posting comment:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmitComment} className="space-y-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts or questions..."
            className="w-full px-4 py-3 bg-slate-600 text-white rounded border border-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            rows={4}
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-semibold transition"
          >
            {loading ? "Posting..." : "Post Comment"}
          </button>
        </form>
      ) : (
        <div className="p-4 bg-slate-700/50 rounded">
          <p className="text-slate-300">
            <a href="/auth" className="text-blue-400 hover:text-blue-300">
              Sign in
            </a>{" "}
            to leave a comment.
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-slate-400">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-slate-700/50 p-4 rounded">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-white">{comment.author}</h4>
                <span className="text-xs text-slate-400">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-slate-300">{comment.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
