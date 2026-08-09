import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createHash } from "node:crypto";

const RATE_LIMIT_MAX_PER_HOUR = 20;
const RACE_TYPES = new Set(["pres", "nass", "gov", "shoa"]);

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
      election_slug, pu_id, race_type, entries,
      lat, lng, accuracy_m, captured_at, session_uuid,
      registered_voters, accredited,
    } = body;

    if (typeof election_slug !== "string") return jsonError("election_slug is required", 400);
    if (typeof pu_id !== "string") return jsonError("pu_id is required", 400);
    if (typeof race_type !== "string" || !RACE_TYPES.has(race_type)) return jsonError("invalid race_type", 400);
    if (!Array.isArray(entries) || entries.length === 0) return jsonError("entries must be a non-empty array", 400);
    for (const e of entries) {
      if (typeof e !== "object" || e === null || typeof (e as any).party_code !== "string" || typeof (e as any).votes !== "number" || (e as any).votes < 0) {
        return jsonError("each entry needs a party_code and a non-negative votes number", 400);
      }
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

    const partyCodes = (entries as { party_code: string }[]).map((e) => e.party_code);
    const { data: validParties } = await admin
      .from("parties")
      .select("code")
      .eq("race_type", race_type)
      .in("code", partyCodes);
    const validSet = new Set((validParties ?? []).map((p) => p.code));
    const unknown = partyCodes.filter((c) => !validSet.has(c));
    if (unknown.length > 0) return jsonError(`unknown party_code(s) for this race: ${unknown.join(", ")}`, 400);

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
      p_scope: "election_results",
      p_window_start: windowStart.toISOString(),
      p_max_count: RATE_LIMIT_MAX_PER_HOUR,
    });
    if (rateErr) {
      console.error("rate limit rpc failed", rateErr);
      return jsonError("rate limit check failed", 500);
    }
    if (!withinLimit) return jsonError("rate limit exceeded, try again later", 429);

    // Auto-publishes per spec ("citizen-reported, unofficial" — we
    // present conflicting result sets side by side, never auto-merge or
    // certify one over another; corroboration is the only signal).
    const { data: inserted, error: insertErr } = await admin
      .from("election_reports")
      .insert({
        election_id: election.id,
        type: "result_upload",
        pu_id,
        geom: `SRID=4326;POINT(${lng} ${lat})`,
        accuracy_m,
        captured_at,
        status: "published",
        session_hash: sessionHash,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("insert failed", insertErr);
      return jsonError("failed to record result upload", 500);
    }

    const rows = (entries as { party_code: string; votes: number }[]).map((e) => ({
      election_report_id: inserted.id,
      race_type,
      party_code: e.party_code,
      votes: e.votes,
      registered_voters: typeof registered_voters === "number" ? registered_voters : null,
      accredited: typeof accredited === "number" ? accredited : null,
    }));
    const { error: entriesErr } = await admin.from("result_entries").insert(rows);
    if (entriesErr) {
      console.error("result_entries insert failed", entriesErr);
      await admin.from("election_reports").delete().eq("id", inserted.id);
      return jsonError("failed to record vote entries", 500);
    }

    const { data: corroborationCount } = await admin.rpc("compute_result_corroboration", {
      p_election_report_id: inserted.id,
    });

    return Response.json(
      { election_report_id: inserted.id, status: "published", corroboration_count: corroborationCount ?? 1 },
      { status: 201 },
    );
  }),
};
