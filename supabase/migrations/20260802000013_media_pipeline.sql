-- Two buckets: quarantine (private, freshly uploaded, unprocessed) and
-- clean (public, only ever written to by the media pipeline worker after
-- EXIF strip + verify + hash + watermark + safety score).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-quarantine', 'media-quarantine', false, 5242880, array['image/jpeg', 'image/webp']),
  ('media', 'media', true, 5242880, array['image/jpeg', 'image/webp']);

-- No storage.objects policies are added for anon/authenticated on either
-- bucket: all reads/writes go through Edge Functions (signed URLs) and
-- the pipeline worker, both using the service_role key, which bypasses
-- storage RLS entirely. The 'media' bucket is marked public at the
-- bucket level so published photos are servable by URL without a signed
-- request, but nothing can *list* or *write* into it directly.

create type media_processing_status as enum ('pending', 'processing', 'clean', 'rejected');

alter table report_media
  add column processing_status media_processing_status not null default 'pending',
  add column rejection_reason text;

create index report_media_processing_status_idx on report_media (processing_status)
  where processing_status = 'pending';
