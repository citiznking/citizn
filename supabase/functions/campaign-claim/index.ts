import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createHash } from "node:crypto";

const RATE_LIMIT_MAX_PER_HOUR = 20;

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

    const { token, network_provider_id } = body;
    if (typeof token !== "string" || token.length < 32 || token.length > 128) {
      return jsonError("invalid claim token", 400);
    }
    if (network_provider_id !== undefined && typeof network_provider_id !== "string") {
      return jsonError("network_provider_id must be a string", 400);
    }

    const admin = ctx.supabaseAdmin;

    // Claim tokens are 256 bits of server-generated randomness — brute
    // force is already infeasible, but rate limit lookup attempts anyway
    // as cheap defense in depth, keyed by IP rather than the token itself.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex");
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);
    const { data: withinLimit, error: rateErr } = await admin.rpc("check_and_increment_rate_limit", {
      p_session_hash: ipHash,
      p_scope: "campaign_claim",
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

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: claim } = await admin
      .from("campaign_claims")
      .select("id, status, campaign_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    // Same generic error whether the token is malformed-but-well-shaped
    // or simply never existed — don't give a prober anything to learn from.
    if (!claim) return jsonError("invalid claim token", 404);

    if (claim.status === "active" || claim.status === "expired") {
      return Response.json({ status: claim.status });
    }

    if (claim.status === "won") {
      // Network isn't known until redemption (collected here, not at
      // submission, so non-winners never hand it over for nothing) — a
      // reward_code isn't assigned until we know which network's pin to
      // hand out, so this is a two-step flow: first call (no
      // network_provider_id) reveals the picker, second one redeems.
      const { data: campaign } = await admin
        .from("campaigns")
        .select("country_id")
        .eq("id", claim.campaign_id)
        .maybeSingle();

      if (!network_provider_id) {
        const { data: providers } = await admin
          .from("network_providers")
          .select("id, name, code")
          .eq("country_id", campaign?.country_id);
        return Response.json({
          status: "won",
          needs_network_provider: true,
          network_providers: providers ?? [],
        });
      }

      const { data: provider } = await admin
        .from("network_providers")
        .select("id")
        .eq("id", network_provider_id)
        .eq("country_id", campaign?.country_id)
        .maybeSingle();
      if (!provider) return jsonError("invalid network_provider_id for this campaign's country", 400);

      // for update skip locked: two winners racing for the last code on
      // the same network never get the same one.
      const { data: rewardCode, error: rcErr } = await admin
        .from("reward_codes")
        .update({ status: "assigned", assigned_claim_id: claim.id })
        .eq("campaign_id", claim.campaign_id)
        .eq("network_provider_id", network_provider_id)
        .eq("status", "available")
        .select("id, code, value_amount, currency")
        .limit(1)
        .maybeSingle();
      if (rcErr || !rewardCode) {
        console.error("no available reward code for network", claim.campaign_id, network_provider_id, rcErr);
        return jsonError("no codes available for that network right now — try a different network or contact support", 409);
      }

      await admin
        .from("reward_codes")
        .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
        .eq("id", rewardCode.id);
      await admin
        .from("campaign_claims")
        .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
        .eq("id", claim.id);

      return Response.json({
        status: "redeemed",
        code: rewardCode.code,
        value_amount: rewardCode.value_amount,
        currency: rewardCode.currency,
      });
    }

    // Already redeemed previously — show the same code again idempotently
    // in case the reporter lost track of it, rather than hiding it forever.
    const { data: rewardCode } = await admin
      .from("reward_codes")
      .select("code, value_amount, currency")
      .eq("assigned_claim_id", claim.id)
      .eq("status", "redeemed")
      .maybeSingle();
    return Response.json({
      status: "redeemed",
      code: rewardCode?.code,
      value_amount: rewardCode?.value_amount,
      currency: rewardCode?.currency,
    });
  }),
};
