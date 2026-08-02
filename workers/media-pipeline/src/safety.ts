/**
 * STUB. The spec calls for an NSFW/violence auto-flag safety score, which
 * needs a real image-classification model or API (e.g. AWS Rekognition
 * moderation labels, Google Cloud Vision SafeSearch, or a self-hosted
 * model) — none of which is wired up here, since that requires picking a
 * provider and credentials, a decision this worker shouldn't make
 * silently. This always returns a neutral score so the pipeline's shape
 * (score computed -> compared to threshold -> reject or pass) is real and
 * testable, but nothing here is actually screening content yet. Treat
 * every image as unscreened until a real provider replaces this.
 */
export async function computeSafetyScore(_imageBuf: Buffer): Promise<number> {
  return 1.0;
}
