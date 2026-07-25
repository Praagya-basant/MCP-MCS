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
 * a compact label/value info block, a "View Sample" button, and a plain
 * footer. Deliberately minimal — no marketing styling, no images besides
 * the logo, no "SSM"/"Signed Sample Management" anywhere.
 */
function buildEmailHtml({ heading, rows, btCode }) {
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

  const sampleUrl = `${APP_URL}/sample/${encodeURIComponent(btCode)}`;

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
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                  <tr>
                    <td align="center">
                      <a href="${sampleUrl}" style="display:inline-block;background-color:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:8px 20px;border-radius:6px;">View Sample</a>
                    </td>
                  </tr>
                </table>
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

function buildEmailText({ heading, rows, btCode }) {
  const lines = rows.filter((r) => r.value).map((r) => `${r.label}: ${r.value}`);
  return `${heading}\n\n${lines.join('\n')}\n\nView sample: ${APP_URL}/sample/${encodeURIComponent(btCode)}\n`;
}

async function sendEmail({ to, subject, heading, rows, btCode }) {
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
      html: buildEmailHtml({ heading, rows, btCode }),
      text: buildEmailText({ heading, rows, btCode }),
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

async function getHallIdByNumber(hallNumber) {
  const { data, error } = await supabase.from('halls').select('id').eq('hall_number', hallNumber).maybeSingle();
  if (error) {
    console.error('Failed to look up hall by number', error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Checkout ("Sample Issued") currently fires exactly one email, to the
 * buyer's merchant contacts. No email to the picker and none to the
 * *source* hall's manager (they're the one who just logged this, they
 * already know).
 *
 * A second email — to the manager of the *destination* hall — is wired
 * up below but disabled for now (commented out, not removed). To
 * re-enable it, uncomment the block; it already handles parsing "Hall N"
 * out of `destination`, skipping Supplier/Other, and skipping halls with
 * no manager on file.
 */
async function handleCheckout(payload) {
  const { btCode, productName, hallNumber, buyerId, /* pickedByName, */ destination, reason, pickedAt, loggedByName } = payload;

  const merchantEmails = await getMerchantContactEmails(buyerId);
  const when = formatDateTime(pickedAt);

  await sendEmail({
    to: merchantEmails,
    subject: `Sample Issued — ${btCode} · ${productName}`,
    heading: 'Sample Issued',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Hall', value: hallNumber ? `Hall ${hallNumber}` : '' },
      { label: 'Destination', value: destination },
      { label: 'Reason', value: reason },
      { label: 'Date & Time', value: when },
      { label: 'Logged By', value: loggedByName },
    ],
    btCode,
  });

  // --- Destination hall manager email — disabled for now, see docstring above ---
  // const destinationHallNumber = /^Hall\s+(\d+)$/i.exec((destination || '').trim())?.[1];
  // if (!destinationHallNumber) return;
  //
  // const destHallId = await getHallIdByNumber(Number(destinationHallNumber));
  // if (!destHallId) return;
  //
  // const destManagerEmails = await getHallManagerEmails(destHallId);
  //
  // await sendEmail({
  //   to: destManagerEmails,
  //   subject: `Sample Issued — ${btCode} · ${productName}`,
  //   heading: 'Sample Issued',
  //   rows: [
  //     { label: 'BT Code', value: btCode },
  //     { label: 'Product Name', value: productName },
  //     { label: 'From Hall', value: hallNumber ? `Hall ${hallNumber}` : '' },
  //     { label: 'Picker', value: pickedByName },
  //     { label: 'Reason', value: reason },
  //     { label: 'Date & Time', value: when },
  //   ],
  //   btCode,
  // });
}

async function handleReturn(payload) {
  const { btCode, productName, hallNumber, buyerId, returnedAt } = payload;
  const merchantEmails = await getMerchantContactEmails(buyerId);

  await sendEmail({
    to: merchantEmails,
    subject: `Sample Returned — ${btCode} · ${productName}`,
    heading: 'Sample Returned',
    rows: [
      { label: 'BT Code', value: btCode },
      { label: 'Product Name', value: productName },
      { label: 'Hall', value: hallNumber ? `Hall ${hallNumber}` : '' },
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
