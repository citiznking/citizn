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

    const { token } = body;
    if (typeof token !== "string" || token.length < 32 || token.length > 128) {
      return jsonError("invalid claim token", 400);
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
      .select("id, status")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    // Same generic error whether the token is malformed-but-well-shaped
    // or simply never existed — don't give a prober anything to learn from.
    if (!claim) return jsonError("invalid claim token", 404);

    if (claim.status === "active" || claim.status === "expired") {
      return Response.json({ status: claim.status });
    }

    if (claim.status === "won") {
      const { data: rewardCode, error: rcErr } = await admin
        .from("reward_codes")
        .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
        .eq("assigned_claim_id", claim.id)
        .eq("status", "assigned")
        .select("code, value_amount, currency")
        .maybeSingle();
      if (rcErr || !rewardCode) {
        console.error("reward code redemption failed", rcErr);
        return jsonError("failed to redeem reward, contact support", 500);
      }
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
