#!/usr/bin/env node
/**
 * Mint, list or revoke API tokens for /api/v1/* (YouTube imports).
 *
 *   node scripts/api-token.mjs create --email you@example.com [--name muse]
 *   node scripts/api-token.mjs create --display-name greganthony [--name muse]
 *   node scripts/api-token.mjs list
 *   node scripts/api-token.mjs revoke <token id>
 *
 * The token is printed ONCE. Only its SHA-256 hash is stored. Reads
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [cmd, ...rest] = process.argv.slice(2);
const arg = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

async function findUser() {
  const email = arg("email")?.toLowerCase();
  const display = arg("display-name")?.toLowerCase();
  if (!email && !display) throw new Error("Give --email or --display-name");
  if (display) {
    const { data, error } = await db.from("profiles").select("id, display_name").ilike("display_name", display);
    if (error) throw error;
    if (data.length !== 1) throw new Error(`${data.length} profiles have display name "${display}" — use --email instead.`);
    return { id: data[0].id, label: data[0].display_name };
  }
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return { id: u.id, label: u.email };
    if (data.users.length < 200) break;
  }
  throw new Error(`No user with email ${email}`);
}

if (cmd === "create") {
  const user = await findUser();
  const token = `wa_${randomBytes(30).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await db.from("api_tokens").insert({ user_id: user.id, name: arg("name") ?? "api", token_hash: hash, prefix: token.slice(0, 10) }).select("id").single();
  if (error) throw error;
  console.log(`\nToken for ${user.label} (id ${data.id}):\n\n  ${token}\n\nCopy it now — it won't be shown again. Give it to the agent as:\n  Authorization: Bearer ${token.slice(0, 10)}…\n`);
} else if (cmd === "list") {
  const { data, error } = await db.from("api_tokens").select("id, user_id, name, prefix, created_at, last_used_at, revoked_at").order("created_at");
  if (error) throw error;
  console.table(data.map((t) => ({ id: t.id, name: t.name, prefix: `${t.prefix}…`, created: t.created_at?.slice(0, 10), last_used: t.last_used_at?.slice(0, 16) ?? "never", revoked: t.revoked_at ? "yes" : "" })));
} else if (cmd === "revoke") {
  const id = rest[0];
  if (!id) throw new Error("Give the token id (see: list)");
  const { error } = await db.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  console.log("Revoked.");
} else {
  console.log("Usage: node scripts/api-token.mjs create --email … [--name muse] | list | revoke <id>");
}
