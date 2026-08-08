import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Stopgap admin gate: a shared secret, set as the ADMIN_DRAW_SECRET
// function secret. There's no staff-auth/moderation console yet in this
// build, so this is deliberately the simplest thing that isn't "public" —
// replace with real staff auth (the `moderators` table + Supabase Auth)
// once the moderation console exists.
function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonError("method not allowed", 405);
    }

    const adminSecret = Deno.env.get("ADMIN_DRAW_SECRET");
    if (!adminSecret) {
      console.error("ADMIN_DRAW_SECRET is not configured");
      return jsonError("server misconfigured", 500);
    }
    if (req.headers.get("x-admin-key") !== adminSecret) {
      return jsonError("unauthorized", 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError("invalid JSON body", 400);
    }

    const { country_slug, campaign_slug } = body;
    if (typeof country_slug !== "string" || typeof campaign_slug !== "string") {
      return jsonError("country_slug and campaign_slug are required", 400);
    }

    const admin = ctx.supabaseAdmin;

    const { data: country } = await admin
      .from("countries")
      .select("id")
      .eq("url_slug", country_slug)
      .maybeSingle();
    if (!country) return jsonError("unknown country_slug", 400);

    const { data: campaign } = await admin
      .from("campaigns")
      .select("id")
      .eq("country_id", country.id)
      .eq("slug", campaign_slug)
      .maybeSingle();
    if (!campaign) return jsonError("unknown campaign_slug", 400);

    const { data: winners, error } = await admin.rpc("perform_campaign_draw", {
      p_campaign_id: campaign.id,
    });
    if (error) {
      console.error("draw failed", error);
      return jsonError(error.message, 409);
    }

    return Response.json({
      winner_count: winners?.length ?? 0,
      winners: (winners ?? []).map((w: Record<string, unknown>) => ({
        report_id: w.out_report_id,
      })),
    });
  }),
};
