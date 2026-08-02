import sharp from 'sharp';
import { config } from './config.js';

/**
 * Composites the project's own handle onto the bottom-right corner. This
 * is a provenance/anti-impersonation mark (so a screenshot or re-share is
 * traceable back to the canonical source and a fake-fork's un-watermarked
 * or wrongly-watermarked images are visibly off) — it is never
 * reporter-identifying, only ever the brand handle.
 */
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;

  const fontSize = Math.max(14, Math.round(width * 0.025));
  const paddingX = Math.round(fontSize * 0.8);
  const paddingY = Math.round(fontSize * 0.6);
  const label = config.watermarkHandle;
  const approxTextWidth = label.length * fontSize * 0.6;
  const boxWidth = Math.round(approxTextWidth + paddingX * 2);
  const boxHeight = Math.round(fontSize + paddingY * 2);

  const svg = `
    <svg width="${boxWidth}" height="${boxHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${boxWidth}" height="${boxHeight}" rx="4" fill="black" fill-opacity="0.45"/>
      <text x="${paddingX}" y="${boxHeight - paddingY}" font-family="sans-serif" font-size="${fontSize}" fill="white" fill-opacity="0.9">${label}</text>
    </svg>
  `;

  const margin = Math.round(width * 0.02);

  return image
    .composite([
      {
        input: Buffer.from(svg),
        left: Math.max(0, width - boxWidth - margin),
        top: Math.max(0, height - boxHeight - margin),
      },
    ])
    // Explicitly re-encode without .withMetadata() — sharp does not carry
    // EXIF/ICC/IPTC forward on output unless asked to, so this is the
    // strip step. verify.ts re-checks this rather than trusting it blindly.
    .jpeg({ quality: 85 })
    .toBuffer();
}
