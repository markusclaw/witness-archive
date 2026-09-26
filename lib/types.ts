export interface Testimony {
  id: string;
  title: string;
  description: string;
  video_url: string | null;
  creator: string;
  category: string;
  content: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  testimony_id: string;
  user_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  title: string;
  video_url: string | null;
  creator: string;
  category: string;
  transcript: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
