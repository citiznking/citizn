function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  supabaseUrl: requireEnv('SUPABASE_URL'),
  serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  quarantineBucket: 'media-quarantine',
  cleanBucket: 'media',
  watermarkHandle: '@citiznking',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  batchSize: Number(process.env.BATCH_SIZE ?? 10),
  // Below this, an image is rejected outright rather than published with a
  // low score attached. See safety.ts for why this is a stub threshold.
  safetyRejectThreshold: Number(process.env.SAFETY_REJECT_THRESHOLD ?? 0.15),
};
