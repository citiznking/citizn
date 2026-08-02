import sharp from 'sharp';
import { createHash } from 'node:crypto';

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Average hash (aHash): resize to 8x8 grayscale, compare each pixel to the
 * mean, emit a 64-bit hash as hex. Cheap, dependency-free, and good enough
 * to catch "same photo resubmitted" per the spec's corroboration model —
 * it is not a substitute for a real perceptual-hash library if false
 * positives/negatives on near-duplicates turn out to matter in practice.
 */
export async function averageHashHex(input: Buffer): Promise<string> {
  const { data } = await sharp(input)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;

  let bits = '';
  for (const v of data) bits += v >= mean ? '1' : '0';

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}
