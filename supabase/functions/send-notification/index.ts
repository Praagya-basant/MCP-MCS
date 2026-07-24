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
const FROM_ADDRESS = 'BASANT SSM <noreply@basant.info>';

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

async function sendEmail({ to, subject, text }) {
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
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, text }),
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
  const when = formatDateTime(pickedAt);

  await sendEmail({
    to: merchantEmails,
    subject: `Sample Picked Up — ${btCode}`,
    text:
      `Sample ${btCode} — ${productName} has been picked up from Hall ${hallNumber} by ${pickedByName}. ` +
      `Destination: ${destination}. Reason: ${reason}. Date & Time: ${when}. Logged by: ${loggedByName}.`,
  });

  await sendEmail({
    to: pickedByEmail,
    subject: `Sample Collection Confirmation — ${btCode}`,
    text:
      `This confirms you have collected sample ${btCode} — ${productName} from Hall ${hallNumber}. ` +
      `Reason: ${reason}. Date & Time: ${when}. Please ensure timely return to Hall ${hallNumber}.`,
  });
}

async function handleReturn(payload) {
  const { btCode, productName, hallNumber, buyerId, returnedAt } = payload;
  const merchantEmails = await getMerchantContactEmails(buyerId);

  await sendEmail({
    to: merchantEmails,
    subject: `Sample Returned — ${btCode}`,
    text: `Sample ${btCode} — ${productName} has been returned to Hall ${hallNumber}. Return time: ${formatDateTime(returnedAt)}.`,
  });
}

async function handleRecall(payload) {
  const { btCode, productName, hallId, reason, merchantName } = payload;
  const hallManagerEmails = await getHallManagerEmails(hallId);

  await sendEmail({
    to: hallManagerEmails,
    subject: `Recall Request — ${btCode}`,
    text:
      `A recall has been requested for sample ${btCode} — ${productName} by ${merchantName}. ` +
      `Reason: ${reason || 'Not specified'}. Please arrange return at the earliest.`,
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
