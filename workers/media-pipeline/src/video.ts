import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from './config.js';

const execFileAsync = promisify(execFile);

/**
 * One ffmpeg pass does three things at once, same reasoning as the image
 * pipeline but for video:
 *  - watermark: burns in the project handle, bottom-right, matching the
 *    image watermark's position/style (provenance/anti-impersonation).
 *  - transcode: caps resolution/bitrate. A raw phone clip can be 150-200MB;
 *    this keeps stored/served size predictable regardless of what was
 *    uploaded, which is what actually bounds storage+egress cost at scale.
 *  - strip metadata: video containers can carry GPS/device metadata the
 *    same way EXIF does on images — the same anonymity threat model
 *    applies, so it needs to go the same way EXIF does.
 */
export async function processVideo(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'citizn-video-'));
  const inPath = join(dir, 'in.mp4');
  const outPath = join(dir, 'out.mp4');
  try {
    await writeFile(inPath, input);

    const drawtext = [
      `text='${config.watermarkHandle}'`,
      'x=w-tw-20', 'y=h-th-20',
      'fontsize=24', 'fontcolor=white@0.9',
      'box=1', 'boxcolor=black@0.45', 'boxborderw=8',
    ].join(':');
    const scale = "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease";

    await execFileAsync('ffmpeg', [
      '-y', '-i', inPath,
      '-vf', `${scale},drawtext=${drawtext}`,
      '-map_metadata', '-1',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outPath,
    ], { timeout: 5 * 60 * 1000 });

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Re-checks the output rather than trusting -map_metadata blindly, same
// "verify, don't assume" approach as verify.ts for images. ffprobe's tag
// dump doesn't cover every possible metadata scheme a container can carry,
// so like isMetadataClean this catches the common cases, not everything.
export async function isVideoMetadataClean(buf: Buffer): Promise<boolean> {
  const dir = await mkdtemp(join(tmpdir(), 'citizn-video-verify-'));
  const path = join(dir, 'check.mp4');
  try {
    await writeFile(path, buf);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', path,
    ]);
    const parsed = JSON.parse(stdout);
    const tags: Record<string, string> = parsed.format?.tags ?? {};
    const suspicious = Object.keys(tags).some((k) =>
      /location|gps|latitude|longitude/i.test(k),
    );
    return !suspicious;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
