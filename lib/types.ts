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
  language: string;
  witness_name: string | null;
  witness_relationship: WitnessRelationship;
  source_credit: string | null;
  retelling_of: string | null;
  experienced_precision: DatePrecision;
  location_text: string | null;
  location_city: string | null;
  location_region: string | null;
  location_country: string | null;
  location_country_code: string | null;
  view_count: number;
  heart_count: number;
}

export type DatePrecision = "day" | "month" | "year" | "approx";

/** What the details assistant proposes from the text of a testimony. */
export type WitnessRelationship = "self" | "shared";

export interface ExtractedDetails {
  titles: string[];
  /** The person the experience happened to, if the text names them ("My name is …"). */
  witness: { name: string; first_person: boolean; evidence: string } | null;
  /** Ministry / channel / interviewer credited in the text, if any. */
  source: string | null;
  description: string | null;
  category: string | null;
  experienced: { date: string; precision: DatePrecision; evidence: string } | null;
  location: { text: string; city: string | null; region: string | null; country: string | null; country_code: string | null; evidence: string } | null;
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
  | "language"
  | "witness_name"
  | "witness_relationship"
  | "source_credit"
  | "experienced_precision"
  | "location_text"
  | "location_city"
  | "location_region"
  | "location_country"
  | "location_country_code"
>;

export interface Comment {
  id: string;
  testimony_id: string;
  user_id: string;
  author: string;
  content: string;
  created_at: string;
  parent_id: string | null;
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

export interface Translation {
  testimony_id: string;
  language: string;
  title: string;
  description: string;
  content: string | null;
  source: "machine" | "author" | "reviewed";
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface AskSource {
  n: number;
  id: string;
  title: string;
  author: string;
  category: string;
  path: string;
  snippet: string;
}

export interface AskResult {
  question: string;
  answer: string;
  sources: AskSource[];
  matches: Testimony[];
  cached: boolean;
  /** No testimony addressed the question; `matches` may still hold keyword hits. */
  empty: boolean;
}
