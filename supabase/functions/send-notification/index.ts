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

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
 * a label/value info block, a "View Sample" button, and a plain footer.
 * Deliberately minimal — no marketing styling, no images besides the logo.
 */
function buildEmailHtml({ heading, rows, btCode }) {
  const visibleRows = rows.filter((r) => r.value);

  const rowsHtml = visibleRows
    .map((r, i) => {
      const border = i < visibleRows.length - 1 ? 'border-bottom:1px solid #E8E8E5;' : '';
      return `
        <tr>
          <td style="padding:10px 0;font-size:14px;line-height:20px;color:#6B6B6B;${border}">${escapeHtml(r.label)}</td>
          <td style="padding:10px 0;font-size:14px;line-height:20px;color:#1A1A1A;font-weight:500;text-align:right;${border}">${escapeHtml(r.value)}</td>
        </tr>`;
    })
    .join('');

  const sampleUrl = `${APP_URL}/sample/${encodeURIComponent(btCode)}`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F8F8F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F8F7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;">
            <tr>
              <td style="padding:24px 32px;text-align:left;">
                <img src="${LOGO_URL}" alt="BASANT" height="36" style="height:36px;width:auto;display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #E8E8E5;line-height:1px;font-size:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 20px;font-size:20px;line-height:28px;font-weight:600;color:#1A1A1A;">${escapeHtml(heading)}</h1>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rowsHtml}
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                  <tr>
                    <td align="center">
                      <a href="${sampleUrl}" style="display:inline-block;background-color:#1A1A1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:10px 24px;border-radius:6px;">View Sample</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-bottom:1px solid #E8E8E5;line-height:1px;font-size:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:20px 32px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:16px;color:#9B9B9B;">BASANT SSM &middot; Signed Sample Management</p>
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

async function handleCheckout(payload) {
  const {
    btCode, productName, hallNumber, buyerId,
    pickedByName, pickedByEmail, destination, reason, pickedAt, loggedByName,
  } = payload;

  const merchantEmails = await getMerchantContactEmails(buyerId);
  const rows = [
    { label: 'BT Code', value: btCode },
    { label: 'Product Name', value: productName },
    { label: 'Hall', value: hallNumber ? `Hall ${hallNumber}` : '' },
    { label: 'Issued To', value: pickedByName },
    { label: 'Destination', value: destination },
    { label: 'Reason', value: reason },
    { label: 'Date & Time', value: formatDateTime(pickedAt) },
    { label: 'Logged By', value: loggedByName },
  ];

  await sendEmail({
    to: merchantEmails,
    subject: `Sample Picked Up — ${btCode}`,
    heading: 'Sample Issued',
    rows,
    btCode,
  });

  await sendEmail({
    to: pickedByEmail,
    subject: `Sample Collection Confirmation — ${btCode}`,
    heading: 'Sample Issued',
    rows,
    btCode,
  });
}

async function handleReturn(payload) {
  const { btCode, productName, hallNumber, buyerId, returnedAt } = payload;
  const merchantEmails = await getMerchantContactEmails(buyerId);

  await sendEmail({
    to: merchantEmails,
    subject: `Sample Returned — ${btCode}`,
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
    subject: `Recall Request — ${btCode}`,
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
