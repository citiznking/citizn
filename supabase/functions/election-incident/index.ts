import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createHash } from "node:crypto";

const RATE_LIMIT_MAX_PER_HOUR = 20;
const CATEGORIES = new Set(["violence", "vote_buying", "intimidation", "materials_missing", "other"]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("method not allowed", 405);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("invalid JSON body", 400);
    }

    const {
      election_slug, pu_id, category, note,
      lat, lng, accuracy_m, captured_at, session_uuid,
    } = body;

    if (typeof election_slug !== "string") return jsonError("election_slug is required", 400);
    if (typeof pu_id !== "string") return jsonError("pu_id is required", 400);
    if (typeof category !== "string" || !CATEGORIES.has(category)) return jsonError("invalid category", 400);
    if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 280)) {
      return jsonError("note must be a string up to 280 characters", 400);
    }
    if (typeof lat !== "number" || typeof lng !== "number") return jsonError("lat/lng are required numbers", 400);
    if (typeof accuracy_m !== "number" || accuracy_m < 0) return jsonError("accuracy_m is required", 400);
    if (typeof captured_at !== "string" || Number.isNaN(Date.parse(captured_at))) {
      return jsonError("captured_at must be a valid date string", 400);
    }
    if (typeof session_uuid !== "string" || session_uuid.length < 16) return jsonError("session_uuid is required", 400);

    const admin = ctx.supabaseAdmin;

    const { data: pu } = await admin
      .from("polling_units")
      .select("id, country_id")
      .eq("id", pu_id)
      .maybeSingle();
    if (!pu) return jsonError("unknown pu_id", 400);

    const { data: election } = await admin
      .from("elections")
      .select("id")
      .eq("slug", election_slug)
      .eq("country_id", pu.country_id)
      .eq("active", true)
      .maybeSingle();
    if (!election) return jsonError("unknown or inactive election_slug", 400);

    const { data: fence, error: fenceErr } = await admin
      .rpc("election_geofence_check", { p_pu_id: pu_id, p_lat: lat, p_lng: lng, p_accuracy_m: accuracy_m })
      .single();
    if (fenceErr || !fence) {
      console.error("geofence check failed", fenceErr);
      return jsonError("geofence check failed — this polling unit may have no coordinates on file yet", 500);
    }
    if (!fence.within_fence) {
      return jsonError("device location is outside the geofence of this polling unit", 422);
    }

    const salt = Deno.env.get("SESSION_SALT");
    if (!salt) {
      console.error("SESSION_SALT is not configured");
      return jsonError("server misconfigured", 500);
    }
    const sessionHash = createHash("sha256").update(session_uuid + salt).digest("hex");

    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const { data: withinLimit, error: rateErr } = await admin.rpc("check_and_increment_rate_limit", {
      p_session_hash: sessionHash,
      p_scope: "election_incident",
      p_window_start: windowStart.toISOString(),
      p_max_count: RATE_LIMIT_MAX_PER_HOUR,
    });
    if (rateErr) {
      console.error("rate limit rpc failed", rateErr);
      return jsonError("rate limit check failed", 500);
    }
    if (!withinLimit) return jsonError("rate limit exceeded, try again later", 429);

    // Always pending — election_reports_moderation_gate (DB trigger)
    // enforces this as a second line of defense too, same pattern as
    // violence/police_issue on the condition-reporting side.
    const { data: inserted, error: insertErr } = await admin
      .from("election_reports")
      .insert({
        election_id: election.id,
        type: "incident",
        pu_id,
        geom: `SRID=4326;POINT(${lng} ${lat})`,
        accuracy_m,
        captured_at,
        status: "pending",
        session_hash: sessionHash,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("insert failed", insertErr);
      return jsonError("failed to record incident", 500);
    }

    const { error: detailErr } = await admin
      .from("incident_details")
      .insert({ election_report_id: inserted.id, category, note: note ?? null });
    if (detailErr) {
      console.error("incident_details insert failed", detailErr);
      await admin.from("election_reports").delete().eq("id", inserted.id);
      return jsonError("failed to record incident details", 500);
    }

    return Response.json({ election_report_id: inserted.id, status: "pending" }, { status: 201 });
  }),
};
