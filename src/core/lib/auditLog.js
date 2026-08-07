import { supabase } from '@/core/lib/supabaseClient';

/**
 * Fire-and-forget audit trail entry for a state-changing admin action.
 * `actor_id` defaults to auth.uid() server-side (see audit_log's column
 * default in schema.sql) so the client never needs to look up its own
 * user id — just action + details. Never awaited by callers for its own
 * sake: a failed audit write must not block or roll back the action it's
 * describing, same principle as notify().
 */
export function logAuditEvent(action, details = {}) {
  supabase
    .from('audit_log')
    .insert({ action, details })
    .then(() => {});
}
