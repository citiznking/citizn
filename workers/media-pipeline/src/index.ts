import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { processPendingBatch } from './pipeline.js';

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

let shuttingDown = false;
process.on('SIGTERM', () => {
  shuttingDown = true;
});
process.on('SIGINT', () => {
  shuttingDown = true;
});

async function loop(): Promise<void> {
  console.log('citizn media-pipeline: starting poll loop');
  while (!shuttingDown) {
    const processed = await processPendingBatch(supabase);
    if (processed === 0) {
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    }
  }
  console.log('citizn media-pipeline: shutting down');
}

loop().catch((err) => {
  console.error('fatal error in poll loop', err);
  process.exit(1);
});
