// All data fetching happens client-side via supabase-js — no server to
// render on at runtime (this deploys as a static SPA), and routes like
// /Nig/campaigns/[slug] can't be prerendered ahead of time anyway.
export const ssr = false;
export const prerender = false;
