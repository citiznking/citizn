import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createHmac } from "node:crypto";
import OAuth from "oauth-1.0a";

const CATEGORY_LABELS: Record<string, string> = {
  road: "Road", hospital: "Hospital", school: "School", traffic: "Traffic infrastructure",
  power: "Power", water: "Water", sanitation: "Sanitation",
  environmental: "Environmental", violence: "Violence / insecurity",
  police_issue: "Police / security-service issue",
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function getOAuth() {
  return new OAuth({
    consumer: { key: Deno.env.get("X_API_KEY")!, secret: Deno.env.get("X_API_SECRET")! },
    signature_method: "HMAC-SHA1",
    hash_function(baseString: string, key: string) {
      return createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

function xToken() {
  return { key: Deno.env.get("X_ACCESS_TOKEN")!, secret: Deno.env.get("X_ACCESS_SECRET")! };
}

const UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";
const VIDEO_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB, safely under X's per-chunk limit

async function uploadImage(bytes: Uint8Array, mimeType: string): Promise<string> {
  const oauth = getOAuth();
  const authHeader = oauth.toHeader(oauth.authorize({ url: UPLOAD_URL, method: "POST" }, xToken()));

  const form = new FormData();
  form.append("media", new Blob([bytes], { type: mimeType }), "report.jpg");

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: authHeader.Authorization },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`media upload failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.media_id_string;
}

// Video always requires chunked upload on X's API regardless of size —
// INIT (signed as a form-urlencoded POST, so its params ARE part of the
// signature), APPEND per chunk (multipart — only the non-file fields are
// signed, same exclusion rule as the simple image upload), FINALIZE, then
// poll STATUS until X's own async transcode/validation finishes.
async function uploadVideo(bytes: Uint8Array, mimeType: string): Promise<string> {
  const oauth = getOAuth();
  const token = xToken();

  const initData = { command: "INIT", media_type: mimeType, total_bytes: String(bytes.length), media_category: "tweet_video" };
  const initAuth = oauth.toHeader(oauth.authorize({ url: UPLOAD_URL, method: "POST", data: initData }, token));
  const initRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: initAuth.Authorization, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(initData).toString(),
  });
  if (!initRes.ok) throw new Error(`video INIT failed: ${initRes.status} ${await initRes.text()}`);
  const mediaId = (await initRes.json()).media_id_string as string;

  for (let offset = 0, segmentIndex = 0; offset < bytes.length; offset += VIDEO_CHUNK_SIZE, segmentIndex++) {
    const chunk = bytes.subarray(offset, offset + VIDEO_CHUNK_SIZE);
    const appendData = { command: "APPEND", media_id: mediaId, segment_index: String(segmentIndex) };
    const appendAuth = oauth.toHeader(oauth.authorize({ url: UPLOAD_URL, method: "POST", data: appendData }, token));
    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", mediaId);
    form.append("segment_index", String(segmentIndex));
    form.append("media", new Blob([chunk]), "chunk");
    const appendRes = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: appendAuth.Authorization },
      body: form,
    });
    if (!appendRes.ok) throw new Error(`video APPEND segment ${segmentIndex} failed: ${appendRes.status} ${await appendRes.text()}`);
  }

  const finalizeData = { command: "FINALIZE", media_id: mediaId };
  const finalizeAuth = oauth.toHeader(oauth.authorize({ url: UPLOAD_URL, method: "POST", data: finalizeData }, token));
  const finalizeRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: finalizeAuth.Authorization, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(finalizeData).toString(),
  });
  if (!finalizeRes.ok) throw new Error(`video FINALIZE failed: ${finalizeRes.status} ${await finalizeRes.text()}`);
  const finalizeJson = await finalizeRes.json();

  let processingInfo = finalizeJson.processing_info;
  for (let attempt = 0; processingInfo && attempt < 30; attempt++) {
    const waitSecs = processingInfo.check_after_secs ?? 1;
    await new Promise((r) => setTimeout(r, waitSecs * 1000));

    const statusUrl = `${UPLOAD_URL}?command=STATUS&media_id=${mediaId}`;
    const statusAuth = oauth.toHeader(oauth.authorize({ url: statusUrl, method: "GET" }, token));
    const statusRes = await fetch(statusUrl, { headers: { Authorization: statusAuth.Authorization } });
    if (!statusRes.ok) throw new Error(`video STATUS check failed: ${statusRes.status} ${await statusRes.text()}`);
    const statusJson = await statusRes.json();
    processingInfo = statusJson.processing_info;

    if (processingInfo?.state === "succeeded") break;
    if (processingInfo?.state === "failed") {
      throw new Error(`video processing failed: ${JSON.stringify(processingInfo.error)}`);
    }
  }

  return mediaId;
}

async function uploadMedia(bytes: Uint8Array, mimeType: string): Promise<string> {
  return mimeType === "video/mp4" ? uploadVideo(bytes, mimeType) : uploadImage(bytes, mimeType);
}

async function postTweet(text: string, mediaId: string | null): Promise<{ id: string }> {
  const url = "https://api.twitter.com/2/tweets";
  const oauth = getOAuth();
  const authHeader = oauth.toHeader(oauth.authorize({ url, method: "POST" }, xToken()));

  const body: Record<string, unknown> = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader.Authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`tweet post failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data;
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonError("method not allowed", 405);
    }

    const expectedSecret = Deno.env.get("POST_TO_X_SECRET");
    if (!expectedSecret || req.headers.get("x-post-secret") !== expectedSecret) {
      return jsonError("unauthorized", 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("invalid JSON body", 400);
    }
    const { report_id } = body;
    if (typeof report_id !== "string") return jsonError("report_id is required", 400);

    const admin = ctx.supabaseAdmin;

    // Atomic claim: only one caller ever wins this row, and a report can
    // never be posted twice even if the trigger somehow fires more than
    // once (e.g. a future moderation UPDATE after an already-published row).
    const { data: claimed, error: claimErr } = await admin
      .from("reports")
      .update({ posted_to_x_at: new Date().toISOString() })
      .eq("id", report_id)
      .eq("status", "published")
      .is("posted_to_x_at", null)
      .select("id, category, severity, level1_id, reporter_x_handle")
      .maybeSingle();

    if (claimErr) {
      console.error("claim failed", claimErr);
      return jsonError("failed to claim report", 500);
    }
    if (!claimed) {
      return Response.json({ posted: false, reason: "already posted or not eligible" });
    }

    const { data: level1 } = await admin
      .from("admin_level1")
      .select("name")
      .eq("id", claimed.level1_id)
      .maybeSingle();

    const { data: media } = await admin
      .from("report_media")
      .select("storage_path")
      .eq("report_id", claimed.id)
      .eq("processing_status", "clean")
      .limit(1)
      .maybeSingle();

    // The whole point of this feature is the image — until a report has
    // clean media, there's nothing to post. Leaves posted_to_x_at set so
    // this doesn't get retried into a text-only post later; a future
    // media-arrives-after-publish path can clear it if that's wanted.
    if (!media) {
      return Response.json({ posted: false, reason: "no clean media yet" });
    }

    const publicUrl =
      `https://nafziuempbvrexpmehet.supabase.co/storage/v1/object/public/media/${media.storage_path}`;
    const imgRes = await fetch(publicUrl);
    if (!imgRes.ok) {
      console.error("failed to fetch media", publicUrl, imgRes.status);
      return jsonError("failed to fetch report media", 500);
    }
    const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    try {
      const mediaId = await uploadMedia(bytes, mimeType);

      const label = CATEGORY_LABELS[claimed.category as string] ?? claimed.category;
      const location = level1?.name ? `${level1.name}, Nigeria` : "Nigeria";
      const mention = claimed.reporter_x_handle ? ` — reported by @${claimed.reporter_x_handle}` : "";
      const text = `${label} reported in ${location} (${claimed.severity} severity) via Citizn${mention}`;

      const tweet = await postTweet(text, mediaId);

      await admin.from("reports").update({ x_tweet_id: tweet.id }).eq("id", claimed.id);

      return Response.json({ posted: true, tweet_id: tweet.id });
    } catch (err) {
      console.error("X post failed", err);
      // Roll back the claim so a retry (manual or future cron sweep) can
      // pick this report back up instead of it being stuck "posted" with
      // no actual tweet.
      await admin.from("reports").update({ posted_to_x_at: null }).eq("id", claimed.id);
      return jsonError((err as Error).message, 502);
    }
  }),
};
