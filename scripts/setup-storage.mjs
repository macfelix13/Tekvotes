// Idempotently provisions Supabase Storage buckets for TekVotes and runs a live
// upload -> public GET -> delete verification check on both buckets.
//
// Usage: node --env-file=.env.local scripts/setup-storage.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKETS = [
  {
    name: "contestant-media",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  {
    name: "event-media",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
];

// Minimal valid 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function ensureBucket(spec) {
  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;

  const found = (existing ?? []).find((b) => b.name === spec.name);
  if (!found) {
    const { error } = await supabase.storage.createBucket(spec.name, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (error) throw new Error(`createBucket(${spec.name}): ${error.message}`);
    console.log(`[CREATED] Bucket "${spec.name}"`);
  } else {
    const { error } = await supabase.storage.updateBucket(spec.name, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    });
    if (error) throw new Error(`updateBucket(${spec.name}): ${error.message}`);
    console.log(`[VERIFIED] Bucket "${spec.name}" updated`);
  }

  // Live roundtrip smoke test: upload -> public HTTP fetch -> delete
  const probePath = `_healthcheck/probe-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage.from(spec.name).upload(probePath, TINY_PNG, {
    contentType: "image/png",
    upsert: true,
  });
  if (upErr) throw new Error(`upload probe(${spec.name}): ${upErr.message}`);

  const { data: pub } = supabase.storage.from(spec.name).getPublicUrl(probePath);
  const res = await fetch(pub.publicUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`public GET probe(${spec.name}) returned ${res.status}`);

  const { error: delErr } = await supabase.storage.from(spec.name).remove([probePath]);
  if (delErr) throw new Error(`cleanup probe(${spec.name}): ${delErr.message}`);

  console.log(`[OK] Bucket "${spec.name}" passed live upload -> public GET (${res.status}) -> delete check`);
}

async function main() {
  for (const spec of BUCKETS) {
    await ensureBucket(spec);
  }
  console.log("\nAll TekVotes storage buckets are operational.");
}

main().catch((err) => {
  console.error("Storage setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
