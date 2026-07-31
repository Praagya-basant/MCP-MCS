// Supabase Edge Function: send-notification
//
// Single entry point for every transactional email in MCS (checkout,
// return, recall). Runs server-side only, so this is the one place that
// ever touches RESEND_API_KEY — the frontend never sees it.
//
// Deploy:  supabase functions deploy send-notification
// Secrets: supabase secrets set RESEND_API_KEY=your_resend_key
//          (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:praagya@basant.info';
const FROM_ADDRESS = 'BASANT <noreply@basant.info>';
const FEEDBACK_RECIPIENT = 'praagya@basant.info';

// Logo uploaded to the public `sample-images` bucket root — see
// CLAUDE.md setup checklist. App URL is the deployed Vercel frontend;
// the "View Sample" button always points at production regardless of
// which environment fired the notification.
const LOGO_URL = 'https://ztxqksvexjonqmfyjijf.supabase.co/storage/v1/object/public/sample-images/logo-black.png';
const APP_URL = 'https://mcp-mcs.vercel.app';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Matches the frontend's formatDateTime() exactly ("25 Jul 2026, 1:17 PM")
// — built manually rather than via toLocaleString so it can't drift from
// the app's formatting depending on ICU/locale quirks.
function formatDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = SHORT_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${period}`;
}

// Matches the frontend's formatDate() ("25 Jul 2026") — used for plain
// `date` columns (expiry_date has no time component), unlike
// formatDateTime() above which is for timestamptz columns.
function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = SHORT_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Shared layout for every transactional email: logo, divider, heading,
 * a compact label/value info block, an optional free-text paragraph, an
 * optional "View Sample" button, and a plain footer. Deliberately
 * minimal — no marketing styling, no images besides the logo, no
 * "SSM"/"Signed Sample Management" anywhere.
 *
 * `btCode` and `bodyText` are both optional — a feedback email has
 * neither a sample to link nor a fixed label/value shape for its free
 * text, so the button and paragraph blocks are only emitted when the
 * caller actually supplies them.
 */
function buildEmailHtml({ heading, rows, btCode, bodyText }) {
  const visibleRows = rows.filter((r) => r.value);

  const rowsHtml = visibleRows
    .map((r, i) => {
      const border = i < visibleRows.length - 1 ? 'border-bottom:1px solid #E8E8E5;' : '';
      return `
        <tr>
          <td style="padding:7px 0;font-size:12px;line-height:16px;color:#6B6B6B;${border}">${escapeHtml(r.label)}</td>
          <td style="padding:7px 0;font-size:14px;line-height:18px;color:#1A1A1A;font-weight:500;text-align:right;${border}">${escapeHtml(r.value)}</td>
        </tr>`;
    })
    .join('');

  const bodyHtml = bodyText
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:20px;color:#1A1A1A;white-space:pre-wrap;">${escapeHtml(bodyText)}</p>`
    : '';

  const buttonHtml = btCode
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                  <tr>
                    <td align="center">
                      <a href="${APP_URL}/sample/${encodeURIComponent(btCode)}" style="display:inline-block;background-color:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:8px 20px;border-radius:6px;">View Sample</a>
                    </td>
                  </tr>
                </table>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F8F8F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F8F7;padding:20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#FFFFFF;">
            <tr>
              <td style="padding:20px;text-align:left;">
                <img src="${LOGO_URL}" alt="BASANT" height="28" style="height:28px;width:auto;display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #E8E8E5;line-height:1px;font-size:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:20px;">
                <h1 style="margin:0 0 14px;font-size:16px;line-height:22px;font-weight:600;color:#1A1A1A;">${escapeHtml(heading)}</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rowsHtml}
                </table>
                ${bodyHtml}
                ${buttonHtml}
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #E8E8E5;line-height:1px;font-size:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:14px 20px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:16px;color:#9B9B9B;">BASANT &middot; For access issues contact praagya@basant.info</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText({ heading, rows, btCode, bodyText }) {
  const lines = rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`);
  const body = bodyText ? `\n\n${bodyText}\n` : '';
  const link = btCode ? `\nView sample: ${APP_URL}/sample/${encodeURIComponent(btCode)}\n` : '\n';
  return `${heading}\n\n${lines.join('\n')}${body}${link}`;
}

async function sendEmail({ to, subject, heading, rows, btCode, bodyText }) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — skipping send to', to);
    return;
  }
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn('No recipients for subject:', subject);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html: buildEmailHtml({ heading, rows, btCode, bodyText }),
      text: buildEmailText({ heading, rows, btCode, bodyText }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Resend send failed', res.status, body);
  }
}

// Each of these three returns [{ id, email }] rather than plain email
// strings — `id` is what in-app notifications (inserted alongside the
// email in every handler below) need for `notifications.recipient_id`,
// so recipient resolution stays in one place instead of being computed
// twice per event.
async function getMerchantContacts(buyerId) {
  const { data, error } = await supabase
    .from('merchant_contacts')
    .select('profile:profiles(id, email)')
    .eq('buyer_id', buyerId);

  if (error) {
    console.error('Failed to load merchant contacts', error);
    return [];
  }
  return data.map((row) => row.profile).filter((p) => p?.id);
}

async function getHallManagers(hallId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('role', 'hall_manager')
    .eq('hall_id', hallId);

  if (error) {
    console.error('Failed to load hall managers', error);
    return [];
  }
  return data;
}

async function getSuperAdmins() {
  const { data, error } = await supabase.from('profiles').select('id, email').eq('role', 'super_admin');
  if (error) {
    console.error('Failed to load super admins', error);
    return [];
  }
  return data;
}

async function getHallIdByName(name) {
  const { data, error } = await supabase.from('halls').select('id').eq('name', name).maybeSingle();
  if (error) {
    console.error('Failed to look up hall by name', error);
    return null;
  }
  return data?.id ?? null;
}

async function getHallName(hallId) {
  if (!hallId) return '';
  const { data, error } = await supabase.from('halls').select('name').eq('id', hallId).maybeSingle();
  if (error) {
    console.error('Failed to look up hall name', error);
    return '';
  }
  return data?.name || '';
}

function emailsOf(recipients) {
  return recipients.map((r) => r.email);
}

function dedupe(emails) {
  return Array.from(new Set(emails.filter(Boolean)));
}

function dedupeRecipients(recipients) {
  const byId = new Map();
  for (const r of recipients) {
    if (r?.id) byId.set(r.id, r);
  }
  return Array.from(byId.values());
}

/**
 * Writes the in-app bell's `notifications` row for every recipient of an
 * email sent below — same audience, same event, one extra insert. Never
 * throws into the caller: a failed notification insert must not stop the
 * email that already succeeded (or vice versa, since this always runs
 * after sendEmail()).
 */
async function insertNotifications(recipients, { title, message, type, itemType, itemId }) {
  const rows = dedupeRecipients(recipients).map((r) => ({
    recipient_id: r.id,
    title,
    message,
    type,
    item_type: itemType || null,
    item_id: itemId || null,
  }));
  if (rows.length === 0) return;

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('Failed to insert notifications', error);
}

function base64urlToBytes(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The VAPID keypair (see schema.sql section 10 / CLAUDE.md) was generated
// by the `web-push` CLI, which outputs the raw EC point components
// base64url-encoded — not a format Web Crypto's importKey('raw', ...)
// accepts for an ECDSA *private* key, so this reassembles them into a JWK
// (kty EC / crv P-256 / d,x,y) instead. Imported once per cold start, not
// once per push — Deno keeps the isolate warm across invocations.
let vapidKeyPromise = null;
function importVapidPrivateKey() {
  if (!vapidKeyPromise) {
    const publicKeyBytes = base64urlToBytes(VAPID_PUBLIC_KEY); // 0x04 || x(32) || y(32)
    const privateKeyBytes = base64urlToBytes(VAPID_PRIVATE_KEY);
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: bytesToBase64url(privateKeyBytes),
      x: bytesToBase64url(publicKeyBytes.slice(1, 33)),
      y: bytesToBase64url(publicKeyBytes.slice(33, 65)),
      ext: true,
    };
    vapidKeyPromise = crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  return vapidKeyPromise;
}

/**
 * RFC 8292 VAPID auth JWT. Web Crypto's ECDSA sign() already returns the
 * raw r||s signature JWS/ES256 wants (not DER), so no extra reformatting
 * is needed after signing.
 */
async function signVapidJwt(audience) {
  const key = await importVapidPrivateKey();
  const encoder = new TextEncoder();
  const headerB64 = bytesToBase64url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = bytesToBase64url(
    encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: VAPID_SUBJECT }))
  );
  const unsigned = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned));
  return `${unsigned}.${bytesToBase64url(new Uint8Array(signature))}`;
}

/**
 * Sends an EMPTY-body push (VAPID auth only, no RFC 8291 payload
 * encryption) — src/sw.js's `push` listener shows a fixed "you have new
 * activity" notification and lets the app itself supply real content once
 * opened (the bell's own unread fetch). This trades per-notification
 * detail in the OS toast for a much smaller, easier-to-get-right surface
 * than implementing ECDH+HKDF+AES-GCM payload encryption from scratch.
 * A 404/410 means the browser dropped the subscription (uninstalled,
 * permission revoked, etc.) — clean it up rather than retrying forever.
 */
async function sendWebPush(subscription) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  try {
    const jwt = await signVapidJwt(audience);
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        TTL: '86400',
        'Content-Length': '0',
      },
    });

    if (res.status === 404 || res.status === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    } else if (!res.ok) {
      console.error('Web push send failed', res.status, subscription.endpoint);
    }
  } catch (err) {
    console.error('Web push send threw', err);
  }
}

/** Fans a push out to every device (push_subscriptions row) any of `recipients` has registered. */
async function sendWebPushToRecipients(recipients) {
  const ids = dedupeRecipients(recipients).map((r) => r.id);
  if (ids.length === 0) return;

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('profile_id', ids);
  if (error) {
    console.error('Failed to load push subscriptions', error);
    return;
  }

  await Promise.all(subs.map((s) => sendWebPush(s)));
}

/**
 * Architecture stub only — no WhatsApp Business API credentials exist
 * yet. Returns immediately so it's safe to wire into a handler ahead of
 * time without sending anything. Swap the body for a real API call once
 * credentials are provisioned; callers won't need to change.
 */
// eslint-disable-next-line no-unused-vars
async function sendWhatsApp(_to, _message) {
  return;
}

// Destinations that never get a hall-manager email even if a `halls` row
// with that exact name happens to exist (e.g. Mandore is a storage
// location, not a showroom hall with an assigned manager) — mirrors the
// frontend's NON_HALL_DESTINATIONS (Supplier/Other) plus Mandore.
const NON_HOD_DESTINATIONS = ['mandore', 'supplier', 'other'];

/**
 * Checkout ("Sample Issued") sends ONE email covering both the buyer's
 * merchant contacts and — unless the destination is Mandore/Supplier/
 * Other — the destination hall's manager, looked up by name (since
 * `destination` is the hall's `name`, not a parseable "Hall N" string).
 * A single sendEmail() call with a combined `to` list keeps this one
 * thread instead of two separate emails. Missing/unassigned managers are
 * silently skipped, never a failure.
 */
async function handleCheckout(payload) {
  const { sampleId, btCode, productName, hallName, buyerId, destination, reason, pickedAt, loggedByName } = payload;

  const merchantContacts = await getMerchantContacts(buyerId);
  const when = formatDateTime(pickedAt);

  let hodContacts = [];
  if (!NON_HOD_DESTINATIONS.includes(String(destination || '').trim().toLowerCase())) {
    const destHallId = await getHallIdByName(destination);
    if (destHallId) {
      hodContacts = await getHallManagers(destHallId);
    }
  }

  const recipients = [...merchantContacts, ...hodContacts];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Sample Issued — ${btCode} · ${productName}`,
    heading: 'Sample Issued',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Hall', value: hallName || '' },
      { label: 'Destination', value: destination },
      { label: 'Reason', value: reason },
      { label: 'Date & Time', value: when },
      { label: 'Logged By', value: loggedByName },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: 'Sample Issued',
    message: `${btCode} — ${productName} issued to ${destination}`,
    type: 'checkout',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * Sample Forwarded — a checked-out sample moving onward to a new
 * destination (see forward_sample() in schema.sql), distinct from a
 * fresh Issue. Same recipient shape as handleCheckout (merchant contacts
 * + the new destination hall's manager, when it resolves to one).
 */
async function handleForward(payload) {
  const { sampleId, btCode, productName, fromDestination, buyerId, destination, reason, pickedAt } = payload;

  const merchantContacts = await getMerchantContacts(buyerId);

  let hodContacts = [];
  if (!NON_HOD_DESTINATIONS.includes(String(destination || '').trim().toLowerCase())) {
    const destHallId = await getHallIdByName(destination);
    if (destHallId) {
      hodContacts = await getHallManagers(destHallId);
    }
  }

  const recipients = [...merchantContacts, ...hodContacts];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Sample Forwarded — ${btCode} · ${productName}`,
    heading: 'Sample Forwarded',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'From', value: fromDestination },
      { label: 'New Destination', value: destination },
      { label: 'Reason', value: reason },
      { label: 'Date & Time', value: formatDateTime(pickedAt) },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: 'Sample Forwarded',
    message: `${btCode} — ${productName} forwarded to ${destination}`,
    type: 'forward',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * Return sends ONE email covering the buyer's merchant contacts and the
 * sample's OWN (home) hall manager — the one who now has it back and
 * needs to know. `hallId` is the sample's home hall, not a destination,
 * so no Mandore/Supplier/Other exclusion applies here.
 */
async function handleReturn(payload) {
  const { sampleId, btCode, productName, hallName, hallId, buyerId, returnedAt } = payload;
  const merchantContacts = await getMerchantContacts(buyerId);
  const hallManagers = hallId ? await getHallManagers(hallId) : [];
  const recipients = [...merchantContacts, ...hallManagers];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Sample Returned — ${btCode} · ${productName}`,
    heading: 'Sample Returned',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Hall', value: hallName || '' },
      { label: 'Date & Time', value: formatDateTime(returnedAt) },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: 'Sample Returned',
    message: `${btCode} — ${productName} returned to ${hallName || 'its hall'}`,
    type: 'return',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

// Recall raised notifies Admin + the sample's hall manager per the
// notification matrix (others get nothing).
async function handleRecall(payload) {
  const { sampleId, btCode, productName, hallId, reason, merchantName } = payload;
  const hallManagers = await getHallManagers(hallId);
  const admins = await getSuperAdmins();
  const recipients = [...hallManagers, ...admins];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Recall Request — ${btCode} · ${productName}`,
    heading: 'Recall Request',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Requested By', value: merchantName },
      { label: 'Reason', value: reason || 'Not specified' },
      { label: 'Date & Time', value: formatDateTime(new Date().toISOString()) },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: 'Recall Request',
    message: `${merchantName || 'A merchant'} raised a recall for ${btCode} — ${productName}`,
    type: 'recall',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * Fired by the daily send_validity_alerts() pg_cron job (schema.sql,
 * section 8b) for every sample expiring in exactly 30 or 15 days.
 * Recipients are resolved independently here (not passed in the payload),
 * same as checkout/return above — the cron job separately writes the
 * in-app `notifications` rows for the same audience.
 */
async function handleValidityAlert(payload) {
  const { btCode, productName, daysLeft, expiryDate, buyerId, hallId } = payload;
  const merchantContacts = buyerId ? await getMerchantContacts(buyerId) : [];
  const hallManagers = hallId ? await getHallManagers(hallId) : [];
  const admins = await getSuperAdmins();
  const recipients = [...merchantContacts, ...hallManagers, ...admins];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Validity Expiring in ${daysLeft} Days — ${btCode} · ${productName}`,
    heading: 'Sample Validity Expiring',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Expiry Date', value: formatDateOnly(expiryDate) },
      { label: 'Days Remaining', value: String(daysLeft) },
    ],
    btCode,
  });

  // No insertNotifications() call here — the pg_cron job that invoked
  // this (send_validity_alerts() in schema.sql) already wrote the in-app
  // notifications rows for this exact recipient set directly in SQL.
  await sendWebPushToRecipients(recipients);
}

/** Merchant "Request Validity Extension" — admin-only per the notification matrix. */
async function handleValidityRequested(payload) {
  const { sampleId, btCode, productName, requestedByName, requestedMonths, requestedExpiryDate, reason } = payload;
  const admins = await getSuperAdmins();
  const extensionLabel = requestedExpiryDate
    ? formatDateOnly(requestedExpiryDate)
    : requestedMonths
      ? `${requestedMonths} month(s)`
      : 'Not specified';

  await sendEmail({
    to: emailsOf(admins),
    subject: `Validity Extension Requested — ${btCode} · ${productName}`,
    heading: 'Validity Extension Requested',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Requested By', value: requestedByName },
      { label: 'Requested Extension', value: extensionLabel },
      { label: 'Reason', value: reason || 'Not specified' },
    ],
    btCode,
  });

  await insertNotifications(admins, {
    title: 'Validity Extension Requested',
    message: `${requestedByName || 'A merchant'} requested a validity extension (${extensionLabel}) for ${btCode} — ${productName}`,
    type: 'validity_requested',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(admins);
}

/**
 * Fires after either an admin's direct "Manage Validity" edit or an
 * approved validity_requests row — both just land on a new expiry_date.
 */
async function handleValidityExtended(payload) {
  const { sampleId, btCode, productName, buyerId, newExpiryDate, reason } = payload;
  const merchantContacts = buyerId ? await getMerchantContacts(buyerId) : [];
  const admins = await getSuperAdmins();
  const recipients = [...merchantContacts, ...admins];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Validity Updated — ${btCode} · ${productName}`,
    heading: 'Validity Updated',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'New Expiry Date', value: formatDateOnly(newExpiryDate) },
      { label: 'Reason', value: reason || 'Not specified' },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: 'Validity Updated',
    message: `${btCode} — ${productName} validity updated to ${formatDateOnly(newExpiryDate)}`,
    type: 'validity_extended',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * Hall shift raised — notifies the *other* party (whichever of the
 * current hall's manager / the sample's merchant didn't raise it) plus
 * admin, who needs to act on it. The raiser is excluded so they don't get
 * notified of their own action.
 */
async function handleShiftRequested(payload) {
  const { sampleId, btCode, productName, buyerId, fromHallId, toHallId, note, requestedByName, requestedByRole, requestedById } =
    payload;

  const merchantContacts = buyerId ? await getMerchantContacts(buyerId) : [];
  const hallManagers = fromHallId ? await getHallManagers(fromHallId) : [];
  const admins = await getSuperAdmins();
  const recipients = [...merchantContacts, ...hallManagers, ...admins].filter((r) => r.id !== requestedById);

  const [fromHallName, toHallName] = await Promise.all([getHallName(fromHallId), getHallName(toHallId)]);

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Hall Shift Requested — ${btCode} · ${productName}`,
    heading: 'Hall Shift Requested',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'From Hall', value: fromHallName },
      { label: 'To Hall', value: toHallName },
      { label: 'Requested By', value: `${requestedByName || ''}${requestedByRole ? ` (${requestedByRole})` : ''}` },
      { label: 'Note', value: note || 'Not specified' },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: 'Hall Shift Requested',
    message: `${requestedByName || 'Someone'} requested moving ${btCode} — ${productName} from ${fromHallName} to ${toHallName}`,
    type: 'shift_requested',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * Hall shift approved/rejected — notifies both the origin and (on
 * approval) destination hall managers plus the sample's merchant. Admin
 * doesn't need notifying of their own decision.
 */
async function handleShiftDecided(payload) {
  const { sampleId, btCode, productName, buyerId, fromHallId, toHallId, approved, adminNote } = payload;

  const merchantContacts = buyerId ? await getMerchantContacts(buyerId) : [];
  const fromHallManagers = fromHallId ? await getHallManagers(fromHallId) : [];
  const toHallManagers = approved && toHallId ? await getHallManagers(toHallId) : [];
  const recipients = [...merchantContacts, ...fromHallManagers, ...toHallManagers];

  const [fromHallName, toHallName] = await Promise.all([getHallName(fromHallId), getHallName(toHallId)]);
  const heading = approved ? 'Hall Shift Approved' : 'Hall Shift Rejected';

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `${heading} — ${btCode} · ${productName}`,
    heading,
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'From Hall', value: fromHallName },
      { label: 'To Hall', value: toHallName },
      { label: 'Admin Note', value: adminNote || 'Not specified' },
    ],
    btCode,
  });

  await insertNotifications(recipients, {
    title: heading,
    message: approved
      ? `${btCode} — ${productName} moved from ${fromHallName} to ${toHallName}`
      : `Request to move ${btCode} — ${productName} to ${toHallName} was rejected`,
    type: approved ? 'shift_approved' : 'shift_rejected',
    itemType: 'sample',
    itemId: sampleId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * MCP (panels) equivalents of handleCheckout/handleForward/handleReturn/
 * a retire event — same recipient shapes, own notification types
 * ('panel_checkout' etc, not 'checkout') since the copy needs Panel/
 * panel_code wording, and none of these pass `btCode` to sendEmail —
 * there's no /panel/:code deep-link route to build a "View" button
 * around, so these emails are informational only, no button.
 */
async function handlePanelCheckout(payload) {
  const { panelId, panelCode, panelName, hallName, buyerId, destination, reason, pickedAt } = payload;

  const merchantContacts = await getMerchantContacts(buyerId);
  let hodContacts = [];
  if (!NON_HOD_DESTINATIONS.includes(String(destination || '').trim().toLowerCase())) {
    const destHallId = await getHallIdByName(destination);
    if (destHallId) hodContacts = await getHallManagers(destHallId);
  }
  const recipients = [...merchantContacts, ...hodContacts];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Panel Issued — ${panelCode} · ${panelName}`,
    heading: 'Panel Issued',
    rows: [
      { label: 'Panel Code', value: panelCode },
      { label: 'Panel Name', value: panelName },
      { label: 'Hall', value: hallName || '' },
      { label: 'Destination', value: destination },
      { label: 'Reason', value: reason },
      { label: 'Date & Time', value: formatDateTime(pickedAt) },
    ],
  });

  await insertNotifications(recipients, {
    title: 'Panel Issued',
    message: `${panelCode} — ${panelName} issued to ${destination}`,
    type: 'panel_checkout',
    itemType: 'panel',
    itemId: panelId,
  });
  await sendWebPushToRecipients(recipients);
}

async function handlePanelForward(payload) {
  const { panelId, panelCode, panelName, fromDestination, buyerId, destination, reason, pickedAt } = payload;

  const merchantContacts = await getMerchantContacts(buyerId);
  let hodContacts = [];
  if (!NON_HOD_DESTINATIONS.includes(String(destination || '').trim().toLowerCase())) {
    const destHallId = await getHallIdByName(destination);
    if (destHallId) hodContacts = await getHallManagers(destHallId);
  }
  const recipients = [...merchantContacts, ...hodContacts];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Panel Forwarded — ${panelCode} · ${panelName}`,
    heading: 'Panel Forwarded',
    rows: [
      { label: 'Panel Code', value: panelCode },
      { label: 'Panel Name', value: panelName },
      { label: 'From', value: fromDestination },
      { label: 'New Destination', value: destination },
      { label: 'Reason', value: reason },
      { label: 'Date & Time', value: formatDateTime(pickedAt) },
    ],
  });

  await insertNotifications(recipients, {
    title: 'Panel Forwarded',
    message: `${panelCode} — ${panelName} forwarded to ${destination}`,
    type: 'panel_forward',
    itemType: 'panel',
    itemId: panelId,
  });
  await sendWebPushToRecipients(recipients);
}

async function handlePanelReturn(payload) {
  const { panelId, panelCode, panelName, hallName, hallId, buyerId, returnedAt } = payload;
  const merchantContacts = await getMerchantContacts(buyerId);
  const hallManagers = hallId ? await getHallManagers(hallId) : [];
  const recipients = [...merchantContacts, ...hallManagers];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Panel Returned — ${panelCode} · ${panelName}`,
    heading: 'Panel Returned',
    rows: [
      { label: 'Panel Code', value: panelCode },
      { label: 'Panel Name', value: panelName },
      { label: 'Hall', value: hallName || '' },
      { label: 'Date & Time', value: formatDateTime(returnedAt) },
    ],
  });

  await insertNotifications(recipients, {
    title: 'Panel Returned',
    message: `${panelCode} — ${panelName} returned to ${hallName || 'its hall'}`,
    type: 'panel_return',
    itemType: 'panel',
    itemId: panelId,
  });
  await sendWebPushToRecipients(recipients);
}

/** Retire notifies the buyer's merchant contacts + the panel's hall manager — it's no longer available to either. */
async function handlePanelRetired(payload) {
  const { panelId, panelCode, panelName, buyerId, hallId, reason } = payload;
  const merchantContacts = buyerId ? await getMerchantContacts(buyerId) : [];
  const hallManagers = hallId ? await getHallManagers(hallId) : [];
  const recipients = [...merchantContacts, ...hallManagers];

  await sendEmail({
    to: dedupe(emailsOf(recipients)),
    subject: `Panel Retired — ${panelCode} · ${panelName}`,
    heading: 'Panel Retired',
    rows: [
      { label: 'Panel Code', value: panelCode },
      { label: 'Panel Name', value: panelName },
      { label: 'Reason', value: reason || 'Not specified' },
    ],
  });

  await insertNotifications(recipients, {
    title: 'Panel Retired',
    message: `${panelCode} — ${panelName} was retired${reason ? `: ${reason}` : ''}`,
    type: 'panel_retired',
    itemType: 'panel',
    itemId: panelId,
  });
  await sendWebPushToRecipients(recipients);
}

/**
 * Manager/merchant "Send Feedback" -> always goes to the fixed
 * praagya@basant.info recipient, not a DB-looked-up admin list — this is
 * a direct line to the app owner, independent of whichever admin
 * accounts exist in `profiles`.
 */
async function handleFeedback(payload) {
  const { subject, message, senderName, senderRole } = payload;

  await sendEmail({
    to: FEEDBACK_RECIPIENT,
    subject: `Feedback — ${subject}`,
    heading: 'New Feedback',
    rows: [
      { label: 'From', value: senderName },
      { label: 'Role', value: senderRole },
      { label: 'Subject', value: subject },
    ],
    bodyText: message,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();

    switch (type) {
      case 'checkout':
        await handleCheckout(payload);
        break;
      case 'forward':
        await handleForward(payload);
        break;
      case 'return':
        await handleReturn(payload);
        break;
      case 'recall':
        await handleRecall(payload);
        break;
      case 'feedback':
        await handleFeedback(payload);
        break;
      case 'validity_alert':
        await handleValidityAlert(payload);
        break;
      case 'validity_requested':
        await handleValidityRequested(payload);
        break;
      case 'validity_extended':
        await handleValidityExtended(payload);
        break;
      case 'shift_requested':
        await handleShiftRequested(payload);
        break;
      case 'shift_decided':
        await handleShiftDecided(payload);
        break;
      case 'panel_checkout':
        await handlePanelCheckout(payload);
        break;
      case 'panel_forward':
        await handlePanelForward(payload);
        break;
      case 'panel_return':
        await handlePanelReturn(payload);
        break;
      case 'panel_retired':
        await handlePanelRetired(payload);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown notification type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-notification error', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
