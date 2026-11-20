import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set in environment.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("Connecting to Supabase PostgreSQL database...");
  await client.connect();
  console.log("Connected successfully!");

  await client.query(`
    create table if not exists _tekvotes_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query(`select id from _tekvotes_migrations`);
  const applied = new Set(rows.map((r) => r.id));

  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[ALREADY APPLIED] ${file}`);
      continue;
    }

    console.log(`[APPLYING] ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), "utf-8");

    try {
      await client.query(sql);
      await client.query(
        `insert into _tekvotes_migrations (id) values ($1)`,
        [file]
      );
      console.log(`[DONE] ${file}`);
    } catch (err) {
      console.error(`[FAILED] ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log("\nAll migrations applied successfully!");
  await client.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
