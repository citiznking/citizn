-- Video support: caps mirror X's own constraints (140s / MP4 only) so
-- anything that clears upload is guaranteed postable, plus a size cap to
-- bound worst-case storage/egress cost per upload regardless of duration.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/webp', 'video/mp4'],
    file_size_limit = 83886080 -- 80MB
where id in ('media-quarantine', 'media');

alter table public.report_media
  add column media_type text not null default 'image' check (media_type in ('image', 'video')),
  add column duration_seconds numeric;

-- sha256 is only known once the pipeline worker has processed the file
-- (for images, it hashes the watermarked output, not the upload) — the
-- initial insert at upload time genuinely doesn't have it yet.
alter table public.report_media alter column sha256 drop not null;
