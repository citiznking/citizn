import sharp from 'sharp';

/**
 * Re-checks the output buffer for residual metadata rather than trusting
 * that the encode step stripped it — matches the spec's threat-model
 * requirement that the pipeline "rejects images whose metadata isn't
 * verifiably clean" instead of assuming client or encoder behavior.
 */
export async function isMetadataClean(buf: Buffer): Promise<boolean> {
  const metadata = await sharp(buf).metadata();
  return !metadata.exif && !metadata.icc && !metadata.iptc && !metadata.xmp;
}
