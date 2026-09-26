import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

/** Client-side: fetch several profiles at once (for comment lists). */
export async function fetchProfiles(ids: string[]): Promise<Record<string, Profile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.from("profiles").select("*").in("id", unique);
  const map: Record<string, Profile> = {};
  for (const p of (data ?? []) as Profile[]) map[p.id] = p;
  return map;
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * Downscale an image file to a square JPEG in the browser before upload so
 * avatars stay small and consistent (no server-side image processing needed).
 */
export async function squareImage(file: File, size = 256): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file doesn't look like an image."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the image.");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the image."))), "image/jpeg", 0.88)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
