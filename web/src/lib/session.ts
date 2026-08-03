const STORAGE_KEY = 'citizn_session_uuid';

/**
 * A random, anonymous, client-generated identifier — never an account.
 * Used only so the server can rate-limit and later corroborate reports
 * without ever knowing who the reporter is (session_hash = sha256(this +
 * server-side salt), computed server-side; this raw value is never sent
 * anywhere except as an opaque token in write requests, and never stored
 * raw on the server).
 */
export function getSessionUuid(): string {
  if (typeof localStorage === 'undefined') return crypto.randomUUID();
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
