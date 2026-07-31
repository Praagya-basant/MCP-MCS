import { supabase } from '@/shared/lib/supabaseClient';

/**
 * Fires the `send-notification` edge function. Never throws into the
 * caller's happy path — email delivery is best-effort and must not block
 * or fail a checkout/return/recall that already succeeded in the DB.
 * @param {'checkout'|'return'|'recall'|'feedback'|'validity_alert'|'validity_requested'|'validity_extended'} type
 * @param {object} payload
 */
export async function sendNotification(type, payload) {
  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: { type, payload },
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('send-notification failed', error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('send-notification threw', err);
  }
}
