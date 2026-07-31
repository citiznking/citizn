# Citizn

A civic planning tool: citizens supply geolocated infrastructure condition data; the platform turns it into prioritized, budget-aware repair intelligence for state and LGA planners. Includes `/Nig2027election`, an anonymous citizen-side record of the 2027 Nigerian elections.

Full spec: [docs/2026-07-31-citizn-rebuild-nig2027election.md](docs/2026-07-31-citizn-rebuild-nig2027election.md).

## Principles

- **Anonymous by architecture.** No accounts, no login, no PII fields for reporters — ever. See the spec's Threat model section before touching anything reporter-adjacent.
- **Neutral transparency.** The product never accuses or editorializes; it publishes what citizens document beside public records.

## Layout

- `web/` — citizen-facing PWA
- `functions/` — Supabase Edge Functions (all writes, geofence validation, moderation API)
- `workers/` — Railway services (budget ingestion, media pipeline)
- `docs/` — specs

## Repo conventions

Commits are authored as `Citizn <hello@citizn.example>` — no personal names, no AI-attribution trailers/footers. A `commit-msg` hook enforces the latter (`git config core.hooksPath .githooks`, already set locally).
