import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { applyWatermark } from './watermark.js';
import { isMetadataClean } from './verify.js';
import { sha256Hex, averageHashHex } from './hash.js';
import { computeSafetyScore } from './safety.js';

interface PendingMedia {
  id: string;
  report_id: string;
  storage_path: string;
}

async function reject(
  supabase: SupabaseClient,
  media: PendingMedia,
  reason: string,
): Promise<void> {
  await supabase.storage.from(config.quarantineBucket).remove([media.storage_path]);
  await supabase
    .from('report_media')
    .update({ processing_status: 'rejected', rejection_reason: reason })
    .eq('id', media.id);
  console.log(`[reject] ${media.id}: ${reason}`);
}

export async function processOne(supabase: SupabaseClient, media: PendingMedia): Promise<void> {
  const claimed = await supabase
    .from('report_media')
    .update({ processing_status: 'processing' })
    .eq('id', media.id)
    .eq('processing_status', 'pending')
    .select('id');
  if (claimed.error || !claimed.data || claimed.data.length === 0) {
    // Another worker instance already claimed this row; skip.
    return;
  }

  const download = await supabase.storage.from(config.quarantineBucket).download(media.storage_path);
  if (download.error || !download.data) {
    await reject(supabase, media, `download failed: ${download.error?.message ?? 'unknown'}`);
    return;
  }
  const original = Buffer.from(await download.data.arrayBuffer());

  let watermarked: Buffer;
  try {
    watermarked = await applyWatermark(original);
  } catch (err) {
    await reject(supabase, media, `unsupported or corrupt image: ${(err as Error).message}`);
    return;
  }

  if (!(await isMetadataClean(watermarked))) {
    await reject(supabase, media, 'metadata not verifiably clean after strip');
    return;
  }

  const sha256 = sha256Hex(watermarked);

  const dupe = await supabase
    .from('report_media')
    .select('id')
    .eq('sha256', sha256)
    .neq('id', media.id)
    .limit(1);
  if (dupe.data && dupe.data.length > 0) {
    await reject(supabase, media, `exact duplicate of report_media ${dupe.data[0].id}`);
    return;
  }

  const phash = await averageHashHex(watermarked);
  const safetyScore = await computeSafetyScore(watermarked);

  if (safetyScore < config.safetyRejectThreshold) {
    await reject(supabase, media, `safety score ${safetyScore} below threshold`);
    return;
  }

  const cleanPath = media.storage_path;
  const upload = await supabase.storage
    .from(config.cleanBucket)
    .upload(cleanPath, watermarked, { contentType: 'image/jpeg', upsert: false });
  if (upload.error) {
    await reject(supabase, media, `clean-bucket upload failed: ${upload.error.message}`);
    return;
  }

  await supabase.storage.from(config.quarantineBucket).remove([media.storage_path]);

  await supabase
    .from('report_media')
    .update({
      storage_path: cleanPath,
      sha256,
      phash,
      exif_clean: true,
      watermarked: true,
      safety_score: safetyScore,
      processing_status: 'clean',
    })
    .eq('id', media.id);

  console.log(`[clean] ${media.id} -> ${config.cleanBucket}/${cleanPath}`);
}

export async function processPendingBatch(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('report_media')
    .select('id, report_id, storage_path')
    .eq('processing_status', 'pending')
    .limit(config.batchSize);

  if (error) {
    console.error('failed to list pending media', error.message);
    return 0;
  }
  if (!data || data.length === 0) return 0;

  for (const media of data as PendingMedia[]) {
    try {
      await processOne(supabase, media);
    } catch (err) {
      console.error(`unhandled error processing ${media.id}`, err);
      await reject(supabase, media, `unhandled error: ${(err as Error).message}`);
    }
  }
  return data.length;
}
