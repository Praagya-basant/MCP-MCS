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

async function getMerchantContactEmails(buyerId) {
  const { data, error } = await supabase
    .from('merchant_contacts')
    .select('profile:profiles(email)')
    .eq('buyer_id', buyerId);

  if (error) {
    console.error('Failed to load merchant contacts', error);
    return [];
  }
  return data.map((row) => row.profile?.email).filter(Boolean);
}

async function getHallManagerEmails(hallId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'hall_manager')
    .eq('hall_id', hallId);

  if (error) {
    console.error('Failed to load hall managers', error);
    return [];
  }
  return data.map((row) => row.email).filter(Boolean);
}

async function getSuperAdminEmails() {
  const { data, error } = await supabase.from('profiles').select('email').eq('role', 'super_admin');
  if (error) {
    console.error('Failed to load super admins', error);
    return [];
  }
  return data.map((row) => row.email).filter(Boolean);
}

async function getHallIdByName(name) {
  const { data, error } = await supabase.from('halls').select('id').eq('name', name).maybeSingle();
  if (error) {
    console.error('Failed to look up hall by name', error);
    return null;
  }
  return data?.id ?? null;
}

function dedupe(emails) {
  return Array.from(new Set(emails.filter(Boolean)));
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
  const { btCode, productName, hallName, buyerId, destination, reason, pickedAt, loggedByName } = payload;

  const merchantEmails = await getMerchantContactEmails(buyerId);
  const when = formatDateTime(pickedAt);

  let hodEmails = [];
  if (!NON_HOD_DESTINATIONS.includes(String(destination || '').trim().toLowerCase())) {
    const destHallId = await getHallIdByName(destination);
    if (destHallId) {
      hodEmails = await getHallManagerEmails(destHallId);
    }
  }

  await sendEmail({
    to: dedupe([...merchantEmails, ...hodEmails]),
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
}

/**
 * Return sends ONE email covering the buyer's merchant contacts and the
 * sample's OWN (home) hall manager — the one who now has it back and
 * needs to know. `hallId` is the sample's home hall, not a destination,
 * so no Mandore/Supplier/Other exclusion applies here.
 */
async function handleReturn(payload) {
  const { btCode, productName, hallName, hallId, buyerId, returnedAt } = payload;
  const merchantEmails = await getMerchantContactEmails(buyerId);
  const hallManagerEmails = hallId ? await getHallManagerEmails(hallId) : [];

  await sendEmail({
    to: dedupe([...merchantEmails, ...hallManagerEmails]),
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
}

async function handleRecall(payload) {
  const { btCode, productName, hallId, reason, merchantName } = payload;
  const hallManagerEmails = await getHallManagerEmails(hallId);

  await sendEmail({
    to: hallManagerEmails,
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
  const merchantEmails = buyerId ? await getMerchantContactEmails(buyerId) : [];
  const hallManagerEmails = hallId ? await getHallManagerEmails(hallId) : [];
  const adminEmails = await getSuperAdminEmails();

  await sendEmail({
    to: dedupe([...merchantEmails, ...hallManagerEmails, ...adminEmails]),
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
}

/** Merchant "Request Validity Extension" — admin-only per the notification matrix. */
async function handleValidityRequested(payload) {
  const { btCode, productName, requestedByName, requestedMonths, requestedExpiryDate, reason } = payload;
  const adminEmails = await getSuperAdminEmails();

  await sendEmail({
    to: adminEmails,
    subject: `Validity Extension Requested — ${btCode} · ${productName}`,
    heading: 'Validity Extension Requested',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Requested By', value: requestedByName },
      {
        label: 'Requested Extension',
        value: requestedExpiryDate
          ? formatDateOnly(requestedExpiryDate)
          : requestedMonths
            ? `${requestedMonths} month(s)`
            : 'Not specified',
      },
      { label: 'Reason', value: reason || 'Not specified' },
    ],
    btCode,
  });
}

/**
 * Fires after either an admin's direct "Manage Validity" edit or an
 * approved validity_requests row — both just land on a new expiry_date.
 */
async function handleValidityExtended(payload) {
  const { btCode, productName, buyerId, newExpiryDate, reason } = payload;
  const merchantEmails = buyerId ? await getMerchantContactEmails(buyerId) : [];
  const adminEmails = await getSuperAdminEmails();

  await sendEmail({
    to: dedupe([...merchantEmails, ...adminEmails]),
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
