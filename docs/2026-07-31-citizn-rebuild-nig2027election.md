# Citizn Rebuild + /Nig2027election Module
**Date:** 2026-07-31
**Spec:** docs/2026-07-31-citizn-rebuild-nig2027election.md
**Status:** Draft

---

## Problem

The existing Citizn repo is a 2016 static Bootstrap theme prototype — three HTML pages (index, sendReport, reportsGrid), placeholder template content, jQuery, an embedded Google Map, and no backend. Nothing submitted is ever stored.

Two real problems need solving:

1. **Governments plan budgets and repairs blind.** State and LGA governments allocate money for roads, sanitation, power, schools, hospitals, water, traffic infrastructure, environmental management and public safety without ground-truth data on what is actually broken, where, and how severely. Citizn is **not a complaint app** — it is a civic planning tool: citizens supply geolocated condition data, and the platform turns it into prioritized, budget-aware repair intelligence for State and LGA planners. Revenue data (FAAC allocations to all 774 LGAs, state budgets via BudgIT's Open States) lets planners match documented needs against available funds.

2. **The 2027 election needs a citizen-side record.** Presidential/National Assembly elections hold **16 January 2027**; Governorship/State Assembly hold **6 February 2027** (revised INEC timetable under the Electoral Act 2026). Campaigns begin 19 August 2026 — **the clock is short**. Citizens need a dead-simple, anonymous way to record: did INEC show up at my polling unit, what result was posted on the EC8A at my unit, and did violence occur — across up to 176,846 polling units, on cheap phones, on bad networks.

Why now: the election dates moved earlier, leaving ~5.5 months to election day. Reporter safety is non-negotiable: **the platform must hold zero identity about reporters and be hardened against deanonymization.**

**Positioning principle (governs all product copy and design):** Citizn is presented to government as free planning intelligence, and that offer is real. Its accountability power comes entirely from **neutral transparency**: the platform never accuses, ranks by "corruption," or editorializes — it simply publishes what citizens document beside what public records say was received, permanently and exportably. Effective for a well-run LGA (validated priorities, evidence for budget requests) and self-executing for a badly-run one (the gap between money and outcomes is visible without Citizn saying a word). Every feature and every line of copy must pass this test: *would a government partnerships officer happily demo this page to a commissioner, and would a civil-society group happily cite the same page in a campaign?*

## Scope

**In scope:**
- Full rebuild of Citizn: modern frontend + real backend (Supabase Postgres/Storage/Edge Functions; Railway for API/worker services).
- **Infrastructure condition reporting** down to LGA level: report → geolocated → auto-assigned to State → LGA (→ ward where mappable), with category and severity. Categories citizens can spot: **broken systems** (roads, hospitals, schools, traffic infrastructure, power, water, sanitation), **environmental** (flooding, erosion, waste dumping, pollution), **violence/insecurity** (unsafe areas, incidents), and **police/security-service issues** (checkpoint extortion, misconduct) — the last two framed as public-safety planning data and routed through moderation before publication.
- **Budget context panel** on every report: the LGA's monthly FAAC allocations and the State's relevant approved budget lines, ingested from open-data platforms (BudgIT Open States, GovSpend, NBS/OAGF FAAC publications). State + LGA money only. Framed as planning context, not blame.
- **Government planning dashboard** (`/plan`): per-LGA and per-state view for planners — reports clustered by category/ward, severity-weighted priority ranking, side-by-side with available FAAC/budget capacity, exportable as CSV/PDF briefing for budget cycles. Read-only, public (transparency doubles as the pitch to government), with a "For Government" landing page positioning Citizn as free planning intelligence.
- **Resolution tracking** — the quiet accountability engine: every report has a lifecycle (`reported → acknowledged → in_progress → fixed`, citizen-confirmed via new geofenced photo at the same spot). Public per-LGA metrics: median time-to-repair, % resolved, allocation received over the same period. Neutral numbers; the reader draws conclusions.
- **Shareable snapshots + social sharing**: any report, LGA summary, money panel, or election-day dashboard has one-tap share to X/Twitter, WhatsApp, and Facebook (Web Share API with per-network fallbacks), pre-filled neutral text ("Road condition report, Ikeja LGA — via Citizn"), a generated Open Graph/Twitter Card image so links unfurl with the photo + money figures, and a permanent URL. Data is citable, portable, and never disappears — the archive is the advocacy. Sharing never leaks reporter data (share URLs carry no session tokens; cards show PU/LGA-level location only).
- **Country namespaces**: all citizen-facing routes live under a country slug. v1 switches on **five countries** for condition reporting: Nigeria (`/Nig`), Kenya (`/Ken`), South Africa (`/Saf`), Senegal (`/Sen`), The Gambia (`/Gam`). Each gets its admin boundaries loaded (Kenya: 47 counties → sub-counties; South Africa: 9 provinces → district/metro municipalities; Senegal: 14 regions → departments; The Gambia: regions + Banjul/Kanifing). Ghana (`/Gha`) and others remain seeded-but-inactive, switchable by config. **Nigeria is the only country with the full stack in v1** (budget panels + election module); the other four launch reporting-only with "budget data coming soon."
- **/Nig2027election module** served at `citizn.example/Nig/2027election` (with `/Nig2027election` kept as a redirect alias) and at subdomain `nig2027election.citizn.example` (all resolve to the same app):
  - Pre-election: countdown, key INEC timetable dates, polling unit finder.
  - Election day — three one-tap anonymous report types:
    1. **INEC arrival check-in** (officials/materials arrived at my PU, with timestamp).
    2. **Polling unit result upload** (photo of posted EC8A + typed party vote counts).
    3. **Violence/incident report** (category + optional photo + free text).
- **Anonymity by design**: no accounts, no login, no phone number, no email, no names. Location-proof only: reporter must be physically at/near the thing they report (geofence, see Behaviour).
- Public map + grid views of all report types; LGA/state summaries framed as needs-vs-capacity planning views (not shaming league tables).
- Moderation console (the only authenticated surface, staff-only) for incident triage and result-photo review.
- Lite delivery: PWA, < 200 KB initial payload target, offline queue-and-retry for election-day submissions.

**Out of scope (explicitly):**
- **Federal budget/revenue** — ship a visible "Federal — coming soon" placeholder only.
- **Budget/revenue ingestion and election modules for Kenya, South Africa, Senegal, The Gambia** — those countries launch condition-reporting-only; their money data and elections are later activations. Ghana launches later entirely.
- Reporter accounts, profiles, points/rewards, and the old theme's "agents ready to fix" marketplace.
- Official result collation/declaration — we record *citizen-observed posted results*, we do not declare outcomes.
- SMS/USSD channels (phase 2 candidate).
- Native iOS/Android apps (PWA only for v1).
- Diaspora/out-of-country reporting (geofence excludes it by definition).

## Behaviour

**A. Infrastructure reporting flow**
1. Visitor opens Citizn, taps "Report it — help your LGA plan repairs" — no signup. Copy throughout frames the action as contributing planning data, not filing a complaint.
2. App requests device location; captures GPS fix + accuracy radius. Submission allowed only if the device fix is within the geofence of the pin the reporter drops (see Open questions on radius).
3. Reporter picks a category — broken systems (road, hospital, school, traffic, power, water, sanitation), environmental (flooding, erosion, waste, pollution), violence/insecurity, or police issue — sets severity, adds photo(s) and short description. Client strips all EXIF/metadata from photos before upload.
4. Server reverse-geocodes the fix to State → LGA (→ ward), stores report as `pending`. Infrastructure/environmental reports auto-publish after automated checks (image safety, dedupe); **violence and police-issue reports always go through human moderation first** (higher reporter risk, higher defamation risk).
5. Public report page shows the issue on a map beside a **money panel**: the LGA's last 12 months of FAAC allocations and matching state budget lines for that category, with source citations. Federal tab shows "coming soon."

**B. /Nig2027election — election day**
1. Reporter opens the election page; app locates them and shows the nearest polling units from the PU dataset; they confirm theirs.
2. Geofence check: device must be within the allowed radius of the selected PU's coordinates (accuracy-aware — see Open questions).
3. One screen, three big buttons:
   - **"INEC is here"** → single tap → timestamped arrival check-in.
   - **"Upload result"** → camera opens → photo of posted EC8A → typed vote counts per party → submit. Result photos are EXIF-stripped, hashed for dedupe.
   - **"Report incident"** → category (violence, vote-buying, intimidation, materials missing, other) → optional photo → optional 280-char note → submit.
4. All three work offline: queued locally, auto-submitted when network returns (submission carries the original capture timestamp + the GPS fix taken at capture time).
5. Public dashboard aggregates in near-real-time: % of PUs with INEC arrival by LGA/state, results uploaded per PU (photo + entered figures, marked "citizen-reported, unofficial"), incident heat map. Incident reports are moderated before public display; arrival check-ins and result uploads publish automatically with a corroboration badge (2+ independent submissions agree).
6. Nothing about the reporter is stored: no account, no phone, no name, no raw IP, no device fingerprint retained (see Threat model).

## Acceptance criteria
- [ ] A first-time visitor on a low-end Android over 3G can submit an election-day report (any type) in ≤ 60 seconds and ≤ 3 screens, with initial page payload ≤ 200 KB gzipped.
- [ ] A submission from a device outside the geofence of the selected PU/pin is rejected client-side and server-side (server re-validates; client checks are advisory only).
- [ ] Database and storage contain zero reporter PII: no name/phone/email fields exist; raw IPs are not written to any table or log retained > 24h; uploaded images are verifiably EXIF-free at rest.
- [ ] A broken-system report in any of the 774 LGAs displays that LGA's FAAC allocation history and its state's budget lines with a source link and dataset date.
- [ ] Offline queue: a report captured with airplane mode on submits automatically within 60s of connectivity returning, preserving original capture timestamp.
- [ ] Result upload for a PU shows photo + typed figures publicly within 2 minutes of submission, labelled "citizen-reported, unofficial."
- [ ] Incident, violence, and police-issue reports are invisible publicly until a moderator approves; moderator console requires staff auth + MFA.
- [ ] `/Nig/plan` shows, for any LGA, reports clustered by category with severity-weighted ranking beside FAAC/budget capacity, and exports a CSV/PDF briefing.
- [ ] Sharing any public report to X/WhatsApp/Facebook produces a link that unfurls with the generated card image, and the shared URL contains no session token or precise reporter coordinates.
- [ ] Every report shows its lifecycle status; per-LGA time-to-repair and %-resolved metrics update within 5 minutes of a status change.
- [ ] `/Ken`, `/Saf`, `/Sen`, and `/Gam` accept and publish geolocated condition reports with correct county/province/region/district assignment, and show "budget data coming soon."
- [ ] Activating a further country (e.g. Ghana at `/Gha`) requires only inserting country/admin rows and flipping `countries.active`/feature flags — zero schema or route-code changes (verified in a staging test).
- [ ] Rate limiting holds: one device/session cannot publish more than N reports per PU per hour (N configurable) without being quarantined.

## Open questions
- **Geofence radius:** requested 5 m, but consumer GPS accuracy is typically 5–20 m (worse indoors/urban). Proposal: accept when `distance ≤ max(50 m, device-reported accuracy)`, tunable per report type. Confirm.
- **Domain:** final production domain (citizn.surge.sh is the current CNAME — keep name, new domain?). Subdomain + path must both be wired.
- **PU coordinates dataset:** INEC's official PU list (176,846 units) has incomplete/imprecise coordinates for some units. Which dataset do we license/adopt (GoVote, Nigeria Open Data community sets), and what's the fallback when a PU has no coordinates (ward-centroid geofence?).
- **Party list for result entry:** fixed list per election from INEC's final candidate list — who maintains it?
- **Moderation staffing:** who are the moderators on election day, and what SLA (target: < 15 min for incident triage)?
- **Legal review:** publishing citizen-photographed EC8A results is lawful practice in Nigeria (unofficial), but confirm disclaimers/T&Cs with counsel before election day.
- **Budget data refresh:** BudgIT Open States/GovSpend have no stable public API; scraping cadence and manual-upload fallback need confirming.
- **Multi-country operations:** Senegal is francophone — is v1 English-only with French UI as fast-follow? Who moderates violence/police reports in Kenya, South Africa, Senegal, The Gambia (moderation must exist wherever those categories are enabled, or those categories launch disabled outside Nigeria)?

---

# Technical Plan

## Approach

Supabase is the system of record (Postgres + PostGIS, Storage, Edge Functions, Row Level Security). Railway hosts the two long-running services Supabase functions don't suit: the **ingestion worker** (budget/FAAC scrapers + PU dataset loader) and the **media pipeline** (EXIF strip verification, image hashing, thumbnailing, NSFW/violence auto-flag). Frontend is a static-first PWA (SvelteKit or Next.js static export) on CDN hosting — chosen for the < 200 KB lite budget; server-rendering is unnecessary since all writes go through Edge Functions.

Key decisions:
- **Anonymous-by-architecture, not by policy.** There is no users table for reporters. Abuse control uses an ephemeral anonymous session token (random UUID minted client-side, stored only as a salted hash) + coarse rate limits — never identity.
- **Server-side geofence is the trust anchor.** The client sends `{lat, lng, accuracy, captured_at}`; the Edge Function recomputes distance to the target (PU or dropped pin) in PostGIS and rejects out-of-fence submissions. Client checks are UX only.
- **Corroboration over verification.** Since reporters are anonymous, credibility comes from independent agreement: k-of-n matching check-ins/result figures per PU earn a "corroborated" badge; result photos are perceptually hashed to detect the same photo resubmitted as "independent."
- **Path + subdomain both route to the election module**: `/Nig2027election` (and lowercase alias `/nig2027election`) plus `nig2027election.<domain>` via wildcard DNS → same app, election route.

## Data model changes

New schema (all new — greenfield backend). PostGIS enabled. **Country-ready from day one**: every geographic and election table hangs off `countries`, so Ghana (`/Gha`) and others are config + data loads, not schema changes.

- `countries` (id, iso3, name, url_slug, active, features jsonb e.g. `{reporting: true, money: false, elections: false}`) — v1: Nigeria (all features), Kenya, South Africa, Senegal, The Gambia (reporting only); Ghana seeded inactive
- `admin_level1` (id, country_id FK, name, code, label) — Nigeria: 36 states + FCT (label "State"); Ghana later: 16 regions (label "Region")
- `admin_level2` (id, level1_id FK, name, code, label) — Nigeria: 774 LGAs (label "LGA"); Ghana later: districts
- `wards` (id, level2_id FK, name, code)
- `elections` (id, country_id FK, slug e.g. `2027election`, name, dates jsonb, active)
- `polling_units` (id, ward_id FK, official_pu_code unique per country, name, geom point nullable, geom_source, geofence_radius_m)
- `reports` — condition reports (id, country_id, category enum[road|hospital|school|traffic|power|water|sanitation|environmental|violence|police_issue], severity enum[low|medium|high|critical], description, geom point, accuracy_m, level1_id, level2_id, ward_id nullable, status enum[pending|published|flagged|removed], lifecycle enum[reported|acknowledged|in_progress|fixed] default reported, requires_human_mod bool — true for violence/police_issue, session_hash, created_at) + `lifecycle_events` audit table (report_id, from, to, evidence_media_id nullable, actor enum[citizen_confirmation|moderator], created_at)
- `report_media` (id, report_id FK, storage_path, sha256, phash, exif_clean bool, safety_score)
- `election_reports` (id, type enum[inec_arrival|result_upload|incident], pu_id FK, geom, accuracy_m, captured_at, submitted_at, status, corroboration_count, session_hash)
- `result_entries` (id, election_report_id FK, election enum[pres|nass|gov|shoa], party_code, votes int, registered_voters int nullable, accredited int nullable)
- `incident_details` (election_report_id FK, category enum, note varchar(280))
- `parties` (code, name, election, active)
- `budget_sources` (id, platform, url, retrieved_at, method enum[scrape|manual|api])
- `lga_allocations` (id, level2_id FK, month, gross_amount, net_amount, source_id FK)
- `state_budget_lines` (id, level1_id FK, fiscal_year, sector enum aligned to report categories, line_item, approved_amount, source_id FK)
- `rate_limits` (session_hash, scope, window_start, count)
- `moderators` (Supabase auth users, staff only) + `moderation_actions` (audit log)

Privacy constraints baked into schema: no PII columns anywhere reporter-adjacent; `session_hash = sha256(session_uuid + server_salt)`; salt rotated monthly. RLS: public `select` on published rows only; all writes only via Edge Functions using service role; `moderators` gated by role claim.

## API changes

All writes via Supabase Edge Functions (POST, JSON, rate-limited):
- `POST /api/reports` — broken system `{category, description, lat, lng, accuracy, media_tokens[]}` → `201 {report_id, status}`
- `POST /api/media/sign` — returns signed upload URL + upload token (max 5 MB, jpeg/webp only)
- `POST /api/election/checkin` — `{pu_id, lat, lng, accuracy, captured_at}` → `201`
- `POST /api/election/results` — `{pu_id, election, entries[{party_code, votes}], media_token, lat, lng, accuracy, captured_at}` → `201`
- `POST /api/election/incidents` — `{pu_id?, category, note?, media_token?, lat, lng, accuracy, captured_at}` → `201`

Reads (public, cached, Postgres views → PostgREST or edge-cached JSON):
- `GET /api/pus?near=lat,lng` — nearest polling units
- `GET /api/election/summary?level=state|lga` — arrival %, results count, incident counts
- `GET /api/election/pu/{id}` — check-ins, corroborated results, published incidents
- `GET /api/reports?lga=&category=&status=published`
- `GET /api/money/lga/{id}` / `GET /api/money/state/{id}` — allocations + budget lines with sources

Moderation (staff JWT + MFA): `GET /api/mod/queue`, `POST /api/mod/{id}/approve|reject`.

## Frontend changes

Complete replacement of the three static theme pages.
- Routes (country-namespaced): `/` (country picker across the five active countries, geo-IP-free — manual selection only, remembered locally), `/Nig` (map + grid of condition reports), `/Nig/report` (submit flow), `/Nig/report/{id}` (detail + money panel), `/Nig/money/{state|lga}` (budget explorer, Federal tab = "coming soon"), `/Nig/plan` (government planning dashboard + "For Government" landing), `/Nig/2027election` (hub: countdown, timetable, PU finder), `/Nig/2027election/day` (3-button reporting screen), `/Nig/2027election/live` (public dashboard), `/mod` (staff console). `/Nig2027election` 301s to `/Nig/2027election`.
- PWA: service worker precache, IndexedDB offline submission queue, background sync.
- Sharing: OG-image generation endpoint (edge function renders report/summary cards), `<meta>` Twitter Cards on all public detail pages, Web Share API with X/WhatsApp/Facebook intent-URL fallbacks. Exception to the no-third-party rule stays intact: share actions are outbound links only — no social SDKs/embeds/pixels are ever loaded into Citizn pages.
- Lite budget: system fonts, no jQuery/Bootstrap, map tiles lazy-loaded (MapLibre + free OSM tiles), election-day screen works without the map (list-of-nearest-PUs fallback).

## Implementation steps

0. **Repo conventions:** all commits are authored as `Citizn <hello@citizn.example>` — no AI/Claude attribution, no `Co-Authored-By: Claude` trailers, no "Generated with" footers. Enforce via repo-level `git config user.name "Citizn"` / `user.email`, and a commit-msg hook that rejects AI-attribution trailers.
1. Provision Supabase project (enable PostGIS), Railway services (ingest worker, media pipeline), repo scaffold (monorepo: `web/`, `functions/`, `workers/`), CI.
2. Migrations for the full schema above + RLS policies; seed Nigeria (states/LGAs/wards) plus admin boundaries for Kenya, South Africa, Senegal, The Gambia (GADM/OSM boundary datasets); load Nigeria PU dataset (chosen in Open questions) with `geom_source` provenance.
3. Media path: signed-upload Edge Function → media pipeline (EXIF strip + verify, sha256 + phash, safety score) → quarantine bucket → clean bucket.
4. Write Edge Functions for the five POST endpoints with server-side geofence (PostGIS `ST_DWithin`), rate limiting, session-hash minting.
5. Broken-systems frontend (report flow, map/grid, detail page).
6. Budget ingestion worker: BudgIT Open States state budgets + NBS/OAGF FAAC LGA allocations; normalize to `lga_allocations`/`state_budget_lines`; manual CSV upload fallback in mod console; money panel UI.
7. Election module: PU finder, 3-button day screen, offline queue + background sync, live dashboard views + corroboration job.
8. Moderation console (Supabase Auth staff accounts, MFA, audit log).
9. Hardening pass: log scrubbing (no IPs persisted; edge logs TTL ≤ 24h), dependency audit, load test at election-day write rates (target: 500 writes/sec burst), abuse-simulation tests.
10. Subdomain + path routing, domain cutover, `citizn.surge.sh` redirect.
11. Dry run: simulated election day with field testers in ≥ 3 states; fix findings; freeze by 15 Dec 2026.

## Edge cases & risks

- **GPS spoofing:** mock-location apps can fake coordinates. Mitigations: corroboration model, velocity checks (same session_hash reporting from PUs 100 km apart), Play Integrity-style signals unavailable on web — accept residual risk, rely on k-of-n.
- **PUs without coordinates:** fall back to ward-centroid geofence with a wider radius and a `low_confidence_location` flag on the report.
- **Network blackouts on election day** (historically plausible): offline queue is the mitigation; queued reports keep capture-time GPS + timestamp; dashboard marks late-arriving data.
- **Coordinated fake reporting** (e.g., flooding fake results for a PU): conflicting result sets for one PU are all displayed with submission counts, never auto-merged; phash blocks photo reuse; quarantine on burst anomalies.
- **Photo of a photo / doctored EC8A:** we present, we don't certify — permanent "citizen-reported, unofficial" labelling + moderator takedown path.
- **Budget data staleness/format drift:** scrapers will break; `budget_sources.retrieved_at` shown in UI; manual upload fallback.
- **Traffic spike:** election day is a 100× burst; pre-scale Supabase tier, queue writes through Edge Functions with backpressure, CDN-cache all reads at 30–60s TTL.
- **Political pressure:** takedown demands, legal threats, or hosting-level pressure once the money-vs-outcomes gap becomes visible. Mitigations: neutral-presentation principle (nothing to point at as defamatory — reports are photos + public records), published takedown policy with human review, offsite encrypted backups of the public dataset, and infrastructure that can be re-homed (IaC scripts, no single-vendor lock-in) within 48h.
- **State-actor blocking/DDoS around election day:** CDN with DDoS absorption, static-first pages that cache fully, and a published read-only mirror strategy.
- **`/Nig2027election` case sensitivity:** normalize route casing server-side.

## Threat model (lightweight)
- **Attacker profiles:** anonymous abusers (fake reports, spam), coordinated political actors (result flooding, deanonymization attempts), hostile insiders at hosting/CDN, state-level network observer, compromised moderator account.
- **Sensitive assets touched:** reporter location at capture time (the single most dangerous datum), incident photos/notes, result photos, moderator credentials, server salt for session hashes.
- **Worst-case scenario:** deanonymization of a violence reporter (location + timestamp + photo could identify them to attackers) — physical-safety risk, not just data risk.
- **Pre-build mitigations to bake in:**
  - Coarsen published location: public views round coordinates to PU/LGA level; precise fix kept only transiently for geofence validation, then reduced to `pu_id`/`lga_id` + distance-pass boolean.
  - No raw IPs/device fingerprints persisted; edge/server logs scrubbed, TTL ≤ 24h; session hashes salted + salt rotation; no third-party analytics/CDN beacons on reporting pages.
  - EXIF stripping enforced server-side (client strip is not trusted); pipeline rejects images whose metadata isn't verifiably clean.
  - Moderator accounts: MFA mandatory, least-privilege roles, full audit log; incident notes visible only to moderators until approved-for-public with redaction step.
