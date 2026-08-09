import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
};
const MAX_FILE_SIZE = 83886080; // 80MB, mirrors the bucket's file_size_limit
const MAX_VIDEO_DURATION_S = 140; // X's own cap — no point accepting longer

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonError("method not allowed", 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("invalid JSON body", 400);
    }

    const { report_id, mime_type, file_size, duration_seconds } = body;

    if (typeof report_id !== "string") return jsonError("report_id is required", 400);
    if (typeof mime_type !== "string" || !(mime_type in MIME_EXT)) {
      return jsonError("mime_type must be one of image/jpeg, image/webp, video/mp4", 400);
    }
    if (typeof file_size !== "number" || file_size <= 0 || file_size > MAX_FILE_SIZE) {
      return jsonError(`file_size must be a positive number <= ${MAX_FILE_SIZE}`, 400);
    }

    const isVideo = mime_type === "video/mp4";
    if (isVideo) {
      if (typeof duration_seconds !== "number" || duration_seconds <= 0 || duration_seconds > MAX_VIDEO_DURATION_S) {
        return jsonError(`duration_seconds is required for video and must be <= ${MAX_VIDEO_DURATION_S}`, 400);
      }
    }

    const admin = ctx.supabaseAdmin;

    // report_id is an unguessable UUID, only ever known to the reporter
    // (or a moderator) — same "possession is authorization" model the
    // claim token uses. No separate auth beyond knowing this exists.
    const { data: report } = await admin
      .from("reports")
      .select("id")
      .eq("id", report_id)
      .maybeSingle();
    if (!report) return jsonError("unknown report_id", 400);

    const ext = MIME_EXT[mime_type];
    const storagePath = `${report_id}/${crypto.randomUUID()}.${ext}`;

    const { data: signed, error: signErr } = await admin.storage
      .from("media-quarantine")
      .createSignedUploadUrl(storagePath);
    if (signErr || !signed) {
      console.error("failed to create signed upload url", signErr);
      return jsonError("failed to prepare upload", 500);
    }

    const { data: media, error: insertErr } = await admin
      .from("report_media")
      .insert({
        report_id,
        storage_path: storagePath,
        media_type: isVideo ? "video" : "image",
        duration_seconds: isVideo ? duration_seconds : null,
      })
      .select("id")
      .single();
    if (insertErr || !media) {
      console.error("failed to insert report_media", insertErr);
      return jsonError("failed to register upload", 500);
    }

    return Response.json({
      report_media_id: media.id,
      storage_path: storagePath,
      signed_url: signed.signedUrl,
      token: signed.token,
    });
  }),
};
