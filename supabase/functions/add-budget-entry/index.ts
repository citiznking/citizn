import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const METHODS = new Set(["scrape", "manual", "api"]);

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

    const { platform, url, retrieved_at, method, level1_id, fiscal_year, sector, line_item, approved_amount } = body;

    if (typeof platform !== "string" || !platform) return jsonError("platform is required", 400);
    if (url !== undefined && url !== null && typeof url !== "string") return jsonError("url must be a string", 400);
    if (typeof retrieved_at !== "string" || Number.isNaN(Date.parse(retrieved_at))) {
      return jsonError("retrieved_at must be a valid date string", 400);
    }
    if (typeof method !== "string" || !METHODS.has(method)) return jsonError("invalid method", 400);
    if (typeof level1_id !== "string") return jsonError("level1_id is required", 400);
    if (typeof fiscal_year !== "number" || !Number.isInteger(fiscal_year)) return jsonError("fiscal_year must be an integer", 400);
    if (typeof sector !== "string") return jsonError("sector is required", 400);
    if (typeof line_item !== "string" || !line_item) return jsonError("line_item is required", 400);
    if (typeof approved_amount !== "number" || approved_amount < 0) return jsonError("approved_amount must be a non-negative number", 400);

    const { data: level1 } = await admin.from("admin_level1").select("id").eq("id", level1_id).maybeSingle();
    if (!level1) return jsonError("unknown level1_id", 400);

    const { data: source, error: sourceErr } = await admin
      .from("budget_sources")
      .insert({ platform, url: url ?? null, retrieved_at, method })
      .select("id")
      .single();
    if (sourceErr || !source) {
      console.error("budget_sources insert failed", sourceErr);
      return jsonError("failed to record source", 500);
    }

    const { data: line, error: lineErr } = await admin
      .from("state_budget_lines")
      .insert({ level1_id, fiscal_year, sector, line_item, approved_amount, source_id: source.id })
      .select("id")
      .single();
    if (lineErr || !line) {
      console.error("state_budget_lines insert failed", lineErr);
      return jsonError("failed to record budget line", 500);
    }

    return Response.json({ id: line.id, source_id: source.id }, { status: 201 });
  }),
};
