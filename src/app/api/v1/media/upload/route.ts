import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (under Vercel's 4.5 MB request body cap)
const ALLOWED_BUCKETS = z.enum(["contestant-media", "event-media"]);

function detectImageType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "INVALID_FORM_DATA", message: "Expected multipart/form-data request." },
        { status: 400 }
      );
    }

    const bucketRaw = formData.get("bucket");
    const orgIdRaw = formData.get("organizationId");
    const file = formData.get("file");

    const bucketParsed = ALLOWED_BUCKETS.safeParse(bucketRaw);
    if (!bucketParsed.success) {
      return NextResponse.json(
        { error: "INVALID_BUCKET", message: "Bucket must be contestant-media or event-media." },
        { status: 400 }
      );
    }

    const orgParsed = z.string().uuid("Invalid organizationId").safeParse(orgIdRaw);
    if (!orgParsed.success) {
      return NextResponse.json(
        { error: "INVALID_ORGANIZATION", message: "Valid organizationId is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "MISSING_FILE", message: "Please select an image file to upload." },
        { status: 400 }
      );
    }

    const auth = await requireApiOrgMember(orgParsed.data);
    if (!auth.ok) return auth.response;

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", message: "Image must be between 1 byte and 4 MB." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = detectImageType(bytes);
    if (!detected) {
      return NextResponse.json(
        { error: "INVALID_IMAGE_FORMAT", message: "Only JPEG, PNG, and WebP images are allowed." },
        { status: 415 }
      );
    }

    const objectPath = `${orgParsed.data}/${Date.now()}-${randomUUID()}.${detected.ext}`;
    const admin = createAdminClient();

    const { error: uploadErr } = await admin.storage
      .from(bucketParsed.data)
      .upload(objectPath, bytes, {
        contentType: detected.mime,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr.message);
      return NextResponse.json(
        { error: "UPLOAD_FAILED", message: uploadErr.message },
        { status: 500 }
      );
    }

    const { data: pub } = admin.storage.from(bucketParsed.data).getPublicUrl(objectPath);

    return NextResponse.json(
      {
        bucket: bucketParsed.data,
        path: objectPath,
        publicUrl: pub.publicUrl,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("Media upload error:", message);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
