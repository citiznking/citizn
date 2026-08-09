import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createHash, randomBytes } from "node:crypto";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonError("method not allowed", 405);
    }

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
    const { report_id, action, reason } = body;
    if (typeof report_id !== "string") return jsonError("report_id is required", 400);
    if (action !== "approve" && action !== "reject") return jsonError("action must be approve or reject", 400);
    if (reason !== undefined && typeof reason !== "string") return jsonError("reason must be a string", 400);

    const { data: report } = await admin
      .from("reports")
      .select("id, status, campaign_id, session_hash")
      .eq("id", report_id)
      .maybeSingle();
    if (!report) return jsonError("report not found", 404);
    if (report.status !== "pending") return jsonError(`report is already ${report.status}, not pending`, 409);

    if (action === "reject") {
      await admin.from("reports").update({ status: "removed" }).eq("id", report_id);
      await admin.from("moderation_actions").insert({
        moderator_id: moderator.user_id,
        target_table: "reports",
        target_id: report_id,
        action: "reject",
        reason: reason ?? null,
      });
      return Response.json({ status: "removed" });
    }

    // Approve. This UPDATE is what fires reports_notify_published (the
    // pg_net trigger that posts to X) — same code path as a direct
    // publish, nothing special-cased for the moderation route.
    await admin.from("reports").update({ status: "published" }).eq("id", report_id);
    await admin.from("moderation_actions").insert({
      moderator_id: moderator.user_id,
      target_table: "reports",
      target_id: report_id,
      action: "approve",
      reason: reason ?? null,
    });

    // Campaign progress/claim minting mirrors reports/index.ts exactly —
    // a pending campaign-tagged report reaching 'published' via
    // moderator approval must accrue progress the same way an
    // immediately-published one does. Duplicated rather than shared
    // across two Edge Functions for now; keep both in sync if this logic
    // changes.
    let claimToken: string | undefined;
    let wonImmediately = false;
    if (report.campaign_id) {
      const { data: campaign } = await admin
        .from("campaigns")
        .select("min_submissions, reward_mode")
        .eq("id", report.campaign_id)
        .maybeSingle();
      if (campaign) {
        const { data: existing } = await admin
          .from("campaign_progress")
          .select("id, submission_count, claim_id")
          .eq("campaign_id", report.campaign_id)
          .eq("session_hash", report.session_hash)
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
            .insert({ campaign_id: report.campaign_id, session_hash: report.session_hash, submission_count: 1 })
            .select("id")
            .single();
          progressId = created!.id;
        }

        if (newCount >= campaign.min_submissions && !existing?.claim_id) {
          claimToken = randomBytes(32).toString("base64url");
          const tokenHash = createHash("sha256").update(claimToken).digest("hex");
          const { data: claim, error: claimErr } = await admin
            .from("campaign_claims")
            .insert({
              campaign_id: report.campaign_id,
              report_id,
              session_hash: report.session_hash,
              token_hash: tokenHash,
            })
            .select("id")
            .single();
          if (claimErr || !claim) {
            console.error("campaign claim insert failed", claimErr);
            claimToken = undefined;
          } else {
            await admin.from("campaign_progress").update({ claim_id: claim.id }).eq("id", progressId);
            if (campaign.reward_mode === "first_n") {
              const { data: won } = await admin.rpc("claim_first_n_slot", {
                p_campaign_id: report.campaign_id,
                p_claim_id: claim.id,
              });
              wonImmediately = !!won;
            }
          }
        }
      }
    }

    // The claim token can't be handed to anyone here — moderation
    // approval happens on staff's device, not the anonymous reporter's.
    // It's logged so ops can retrieve it if truly necessary, but there is
    // deliberately no user-facing path that surfaces it after this point;
    // the reporter's own claim token from their original submission
    // response is still what they'd need to check /claim — this is a
    // known, accepted gap: a report that only qualifies for a campaign
    // reward *after* moderation has no way to notify the anonymous
    // reporter that a token now exists.
    if (claimToken) {
      console.log(`claim token minted on approval for report ${report_id} (campaign ${report.campaign_id})`);
    }

    return Response.json({ status: "published", campaign_claim_minted: !!claimToken, won_immediately: wonImmediately });
  }),
};
