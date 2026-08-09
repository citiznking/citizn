import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createHash, randomBytes } from "node:crypto";

const CATEGORIES = new Set([
  "road", "hospital", "school", "traffic", "power", "water", "sanitation",
  "environmental", "violence", "police_issue",
]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const X_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

// Spec's Open Questions proposal (not yet formally confirmed): accept
// when distance <= max(50m, device-reported accuracy). Server-side check
// is the trust anchor; any client-side check is advisory only.
const MIN_GEOFENCE_RADIUS_M = 50;
const RATE_LIMIT_MAX_PER_HOUR = 5;

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

    const {
      country_slug, category, severity, description,
      level1_id, pin_lat, pin_lng, device_lat, device_lng,
      accuracy_m, session_uuid, campaign_slug, reporter_x_handle,
    } = body;

    if (typeof country_slug !== "string") return jsonError("country_slug is required", 400);
    if (typeof category !== "string" || !CATEGORIES.has(category)) return jsonError("invalid category", 400);
    if (typeof severity !== "string" || !SEVERITIES.has(severity)) return jsonError("invalid severity", 400);
    if (typeof level1_id !== "string") return jsonError("level1_id is required", 400);
    if (typeof pin_lat !== "number" || typeof pin_lng !== "number") return jsonError("pin_lat/pin_lng are required numbers", 400);
    if (typeof device_lat !== "number" || typeof device_lng !== "number") return jsonError("device_lat/device_lng are required numbers", 400);
    if (typeof accuracy_m !== "number" || accuracy_m < 0) return jsonError("accuracy_m is required", 400);
    if (typeof session_uuid !== "string" || session_uuid.length < 16) return jsonError("session_uuid is required", 400);
    if (description !== undefined && description !== null && typeof description !== "string") {
      return jsonError("description must be a string", 400);
    }
    if (typeof description === "string" && description.length > 2000) return jsonError("description too long", 400);
    if (campaign_slug !== undefined && campaign_slug !== null && typeof campaign_slug !== "string") {
      return jsonError("campaign_slug must be a string", 400);
    }
    let xHandle: string | null = null;
    if (reporter_x_handle !== undefined && reporter_x_handle !== null && reporter_x_handle !== "") {
      if (typeof reporter_x_handle !== "string") return jsonError("reporter_x_handle must be a string", 400);
      const stripped = reporter_x_handle.replace(/^@/, "");
      if (!X_HANDLE_RE.test(stripped)) return jsonError("invalid reporter_x_handle", 400);
      xHandle = stripped;
    }

    const admin = ctx.supabaseAdmin;

    const { data: country } = await admin
      .from("countries")
      .select("id, active")
      .eq("url_slug", country_slug)
      .maybeSingle();
    if (!country || !country.active) return jsonError("unknown or inactive country", 400);

    const { data: level1 } = await admin
      .from("admin_level1")
      .select("id")
      .eq("id", level1_id)
      .eq("country_id", country.id)
      .maybeSingle();
    if (!level1) return jsonError("level1_id does not belong to country_slug", 400);

    let campaignId: string | null = null;
    let campaignMinSubmissions = 1;
    let campaignRewardMode: "raffle" | "first_n" = "raffle";
    if (typeof campaign_slug === "string") {
      const { data: campaign } = await admin
        .from("campaigns")
        .select("id, status, starts_at, ends_at, min_submissions, reward_mode")
        .eq("country_id", country.id)
        .eq("slug", campaign_slug)
        .maybeSingle();
      const now = Date.now();
      const withinWindow = !!campaign
        && campaign.status === "active"
        && new Date(campaign.starts_at).getTime() <= now
        && (!campaign.ends_at || new Date(campaign.ends_at).getTime() >= now);
      if (!withinWindow) return jsonError("unknown or inactive campaign", 400);
      campaignId = campaign!.id;
      campaignMinSubmissions = campaign!.min_submissions;
      campaignRewardMode = campaign!.reward_mode;
    }

    // Server-side geofence: is the live device fix near the pin the
    // reporter dropped? Proves physical presence at the reported issue.
    const radius = Math.max(MIN_GEOFENCE_RADIUS_M, accuracy_m);
    const { data: distance, error: distErr } = await admin.rpc("geofence_distance_m", {
      lng1: pin_lng, lat1: pin_lat, lng2: device_lng, lat2: device_lat,
    });
    if (distErr) {
      console.error("geofence rpc failed", distErr);
      return jsonError("geofence check failed", 500);
    }
    if (typeof distance === "number" && distance > radius) {
      return jsonError("device location is outside the geofence of the dropped pin", 422);
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
      p_scope: "reports",
      p_window_start: windowStart.toISOString(),
      p_max_count: RATE_LIMIT_MAX_PER_HOUR,
    });
    if (rateErr) {
      console.error("rate limit rpc failed", rateErr);
      return jsonError("rate limit check failed", 500);
    }
    if (!withinLimit) {
      return jsonError("rate limit exceeded, try again later", 429);
    }

    // violence/police_issue always need human review (also enforced by a
    // DB trigger as a second line of defense — this isn't the only place
    // that can never publish these directly).
    //
    // reporter_x_handle is allowed on these too: the frontend requires an
    // explicit "I understand the risk" acknowledgment before it'll send
    // one for a sensitive category, but that's a client-side UX gate, not
    // something this endpoint can verify — so it isn't re-enforced here.
    // Whether to self-identify on a sensitive report is the reporter's
    // informed choice (e.g. a pseudonymous X account carries different
    // risk than a real-name one), not this system's to override.
    const requiresHumanMod = category === "violence" || category === "police_issue";

    const { data: inserted, error: insertErr } = await admin
      .from("reports")
      .insert({
        country_id: country.id,
        category,
        severity,
        description: description ?? null,
        geom: `SRID=4326;POINT(${pin_lng} ${pin_lat})`,
        accuracy_m,
        level1_id,
        level2_id: null,
        campaign_id: campaignId,
        reporter_x_handle: xHandle,
        status: requiresHumanMod ? "pending" : "published",
        requires_human_mod: requiresHumanMod,
        session_hash: sessionHash,
      })
      .select("id, status")
      .single();

    if (insertErr || !inserted) {
      console.error("insert failed", insertErr);
      return jsonError("failed to create report", 500);
    }

    // Progress and claims only count for reports that actually publish —
    // an unmoderated (or later-rejected) sensitive-category report
    // shouldn't hold reward eligibility. There's no moderation console
    // yet to flip pending -> published, so campaign progress on those
    // categories simply doesn't accrue until that exists and is wired to
    // run this same logic on approval.
    let claimToken: string | undefined;
    let progress: { submission_count: number; min_submissions: number } | undefined;
    let wonImmediately = false;

    if (campaignId && inserted.status === "published") {
      const { data: existing } = await admin
        .from("campaign_progress")
        .select("id, submission_count, claim_id")
        .eq("campaign_id", campaignId)
        .eq("session_hash", sessionHash)
        .maybeSingle();

      const newCount = (existing?.submission_count ?? 0) + 1;
      let progressId: string;
      if (existing) {
        progressId = existing.id;
        await admin
          .from("campaign_progress")
          .update({ submission_count: newCount, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        const { data: created } = await admin
          .from("campaign_progress")
          .insert({ campaign_id: campaignId, session_hash: sessionHash, submission_count: 1 })
          .select("id")
          .single();
        progressId = created!.id;
      }

      progress = { submission_count: newCount, min_submissions: campaignMinSubmissions };

      // The claim token is 256 bits of server-side randomness, unrelated
      // to session_hash or anything else the server retains — only its
      // hash is stored, and there is no PostgREST-reachable lookup path
      // back to it. Returned once, here, only on the submission that
      // actually crosses the threshold; the reporter alone holds it after.
      if (newCount >= campaignMinSubmissions && !existing?.claim_id) {
        claimToken = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(claimToken).digest("hex");
        const { data: claim, error: claimErr } = await admin
          .from("campaign_claims")
          .insert({ campaign_id: campaignId, report_id: inserted.id, session_hash: sessionHash, token_hash: tokenHash })
          .select("id")
          .single();

        if (claimErr || !claim) {
          console.error("campaign claim insert failed", claimErr);
          claimToken = undefined;
        } else {
          await admin.from("campaign_progress").update({ claim_id: claim.id }).eq("id", progressId);
          if (campaignRewardMode === "first_n") {
            const { data: won, error: slotErr } = await admin.rpc("claim_first_n_slot", {
              p_campaign_id: campaignId,
              p_claim_id: claim.id,
            });
            if (slotErr) console.error("claim_first_n_slot rpc failed", slotErr);
            wonImmediately = !!won;
          }
        }
      }
    }

    return Response.json(
      {
        report_id: inserted.id,
        status: inserted.status,
        claim_token: claimToken,
        campaign_progress: progress,
        won_immediately: wonImmediately,
      },
      { status: 201 },
    );
  }),
};
