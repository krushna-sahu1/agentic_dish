/**
 * Apply migrations / seed to a Postgres database (your Supabase project).
 *   npm run db:migrate   → runs supabase/migrations/*.sql in order (tracked in public._app_migrations)
 *   npm run db:seed      → runs supabase/seed.sql (demo data; run once on an empty DB)
 * Needs SUPABASE_DB_URL in .env.local (Supabase → Project Settings → Database → connection string).
 */
import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL in .env.local (Supabase → Project Settings → Database → Connection string, URI).");
  process.exit(1);
}
const cmd = process.argv[2];
const dir = join(process.cwd(), "supabase");
const sql = postgres(url, { max: 1, onnotice: () => {}, prepare: false });

async function migrate() {
  await sql`create table if not exists public._app_migrations (name text primary key, applied_at timestamptz default now())`;
  const done = new Set((await sql`select name from public._app_migrations`).map((r) => r.name as string));
  for (const f of readdirSync(join(dir, "migrations")).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) {
      console.log(`✓ ${f} (already applied)`);
      continue;
    }
    process.stdout.write(`→ ${f} ... `);
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, "migrations", f), "utf8"));
      await tx`insert into public._app_migrations (name) values (${f})`;
    });
    console.log("ok");
  }
}

async function seed() {
  const [{ n }] = await sql`select count(*)::int n from public.menu_items`;
  if (n > 0 && !process.argv.includes("--force")) {
    console.log(`Menu already has ${n} items — skipping seed (use --force on a fresh DB only).`);
    return;
  }
  process.stdout.write("→ seed.sql ... ");
  await sql.unsafe(readFileSync(join(dir, "seed.sql"), "utf8"));
  console.log("ok");
}

(async () => {
  try {
    if (cmd === "migrate") await migrate();
    else if (cmd === "seed") await seed();
    else if (cmd === "setup") {
      await migrate();
      await seed();
    } else throw new Error("usage: tsx scripts/db.ts migrate|seed|setup");
  } catch (e) {
    console.error("\n", (e as Error).message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
