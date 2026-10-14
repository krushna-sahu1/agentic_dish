import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SUPA = join(__dirname, "..", "..", "supabase");

/** Minimal stand-in for the parts of Supabase's `auth` schema our SQL uses. */
export const AUTH_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique,
  encrypted_password text, email_confirmed_at timestamptz, phone text,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, email_change text, email_change_token_new text, recovery_token text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users(id), provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
`;

export async function createTestDb({ seed = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(join(SUPA, "migrations")).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(SUPA, "migrations", f), "utf8"));
  }
  if (seed) await db.exec(readFileSync(join(SUPA, "seed.sql"), "utf8"));
  return db;
}

export async function asRole(db: PGlite, role: "service_role" | "authenticated", sub?: string) {
  await db.exec(`select set_config('request.jwt.claim.role', '${role}', false), set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`);
}
