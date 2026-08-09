import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

// Anon/publishable key only. RLS + column-level grants (see the schema
// migrations) are what actually restrict what this client can see — the
// key itself is safe to ship in the client bundle by design.
//
// persistSession is on for the moderation console's login (the only
// thing that uses Supabase Auth at all) — every other page in the app is
// fully anonymous and never touches auth, so this has no effect there.
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true },
});
