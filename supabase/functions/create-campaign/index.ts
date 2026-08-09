import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const REWARD_MODES = new Set(["raffle", "first_n"]);
const REDEMPTION_METHODS = new Set(["voucher_code", "crypto_payout"]);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") return jsonError("method not allowed", 405);

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonError("missing authorization", 401);

    const admin = ctx.supabaseAdmin;

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return jsonError("invalid session", 401);

    const { data: moderator } = await admin
      .from("moderators")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!moderator) return jsonError("not a moderator", 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("invalid JSON body", 400);
    }

    const {
      country_slug, slug, name, description, ends_at,
      reward_count, min_submissions, reward_mode, redemption_method,
    } = body;

    if (typeof country_slug !== "string") return jsonError("country_slug is required", 400);
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
      return jsonError("slug must be lowercase-alphanumeric-with-dashes", 400);
    }
    if (typeof name !== "string" || !name) return jsonError("name is required", 400);
    if (description !== undefined && description !== null && typeof description !== "string") {
      return jsonError("description must be a string", 400);
    }
    if (ends_at !== undefined && ends_at !== null && (typeof ends_at !== "string" || Number.isNaN(Date.parse(ends_at)))) {
      return jsonError("ends_at must be a valid date string", 400);
    }
    if (typeof reward_count !== "number" || !Number.isInteger(reward_count) || reward_count < 0) {
      return jsonError("reward_count must be a non-negative integer", 400);
    }
    const minSub = min_submissions ?? 1;
    if (typeof minSub !== "number" || !Number.isInteger(minSub) || minSub < 1) {
      return jsonError("min_submissions must be a positive integer", 400);
    }
    const mode = reward_mode ?? "raffle";
    if (typeof mode !== "string" || !REWARD_MODES.has(mode)) return jsonError("invalid reward_mode", 400);
    const redemption = redemption_method ?? "voucher_code";
    if (typeof redemption !== "string" || !REDEMPTION_METHODS.has(redemption)) {
      return jsonError("invalid redemption_method", 400);
    }

    const { data: country } = await admin
      .from("countries")
      .select("id")
      .eq("url_slug", country_slug)
      .maybeSingle();
    if (!country) return jsonError("unknown country_slug", 400);

    const { data: campaign, error: insertErr } = await admin
      .from("campaigns")
      .insert({
        country_id: country.id,
        slug,
        name,
        description: description ?? null,
        ends_at: ends_at ?? null,
        reward_count,
        min_submissions: minSub,
        reward_mode: mode,
        redemption_method: redemption,
      })
      .select("id, slug")
      .single();

    if (insertErr || !campaign) {
      console.error("campaign insert failed", insertErr);
      if (insertErr?.code === "23505") return jsonError("a campaign with this slug already exists for this country", 409);
      return jsonError("failed to create campaign", 500);
    }

    return Response.json(campaign, { status: 201 });
  }),
};
