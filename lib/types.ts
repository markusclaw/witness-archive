export type TestimonyStatus = "draft" | "published";

export interface Testimony {
  id: string;
  title: string;
  description: string;
  video_url: string | null;
  creator: string;
  category: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  is_anonymous: boolean;
  author_bio: string | null;
  experienced_on: string | null;
  series_id: string;
  part_number: number;
  status: TestimonyStatus;
}

/** The subset a member edits; everything else is derived or server-managed. */
export type TestimonyDraft = Pick<
  Testimony,
  | "title"
  | "description"
  | "video_url"
  | "creator"
  | "category"
  | "content"
  | "is_anonymous"
  | "author_bio"
  | "experienced_on"
  | "series_id"
  | "part_number"
  | "status"
>;

export interface Comment {
  id: string;
  testimony_id: string;
  user_id: string;
  author: string;
  content: string;
  created_at: string;
}

/** What the formatting assistant returns. */
export interface FormatSuggestion {
  formatted: string;
  notes: string[];
  changed: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}
