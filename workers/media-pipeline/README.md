# media-pipeline

Polls `report_media` rows in `processing_status = 'pending'`, and for each:

1. Downloads the original from the private `media-quarantine` bucket.
2. Composites the `@citiznking` watermark and re-encodes as JPEG — sharp
   does not carry EXIF/ICC/IPTC forward on output unless asked to, so this
   step is also the strip.
3. Re-checks the output's metadata (`verify.ts`) rather than trusting the
   strip blindly.
4. Computes a sha256 (exact-duplicate rejection) and an average hash
   (`hash.ts` — for corroboration/dedupe downstream, not a rejection gate
   on its own).
5. Runs a safety score check — **`safety.ts` is a stub**, see the comment
   there. It always passes. A real NSFW/violence classifier (Rekognition,
   Cloud Vision SafeSearch, or self-hosted) needs to replace it before
   this pipeline can be trusted to auto-flag unsafe content.
6. Uploads the clean result to the public `media` bucket at the same
   path, deletes the quarantine original, and marks the row `clean`.

Any failure at any step rejects the media: the quarantine object is
deleted (never published) and the row is marked `rejected` with a reason.

## Env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — must be the service role key; this worker
  bypasses RLS by design (it's the only thing allowed to write to the
  `media` bucket or flip `report_media.processing_status`).
- `POLL_INTERVAL_MS` (default 5000)
- `BATCH_SIZE` (default 10)
- `SAFETY_REJECT_THRESHOLD` (default 0.15) — irrelevant until `safety.ts`
  is a real classifier.

## Known gaps

- Safety scoring is not real yet (see above).
- Perceptual hash is a from-scratch average hash, not a vetted library —
  fine for catching exact-resubmission-as-independent, unproven for
  near-duplicate detection at scale.
- Runs as a single polling loop; horizontal scaling would need the
  optimistic `processing_status = 'pending'` claim (already in place) to
  stay race-safe across replicas, which it should, but that's untested
  under real concurrency.
