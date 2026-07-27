import { supabase } from '@/shared/lib/supabaseClient';
import { shortenBuyerName } from '@/shared/utils/formatters';

export async function listBuyers() {
  const { data, error } = await supabase.from('buyers').select('*').order('name');
  if (error) throw error;
  return data.map((b) => ({ ...b, name: shortenBuyerName(b.name) }));
}

/**
 * Buyers joined with sample count + merchant contact names, for the
 * Admin /admin/buyers table. Done as three light queries rather
 * than one heavy join so the counts stay easy to reason about.
 */
export async function listBuyersWithDetails() {
  const [{ data: buyers, error: buyersErr }, { data: samples, error: samplesErr }, { data: contacts, error: contactsErr }] =
    await Promise.all([
      supabase.from('buyers').select('*').order('name'),
      supabase.from('samples').select('buyer_id'),
      supabase.from('merchant_contacts').select('id, buyer_id, profile:profiles(id, full_name, email)'),
    ]);

  if (buyersErr) throw buyersErr;
  if (samplesErr) throw samplesErr;
  if (contactsErr) throw contactsErr;

  return buyers.map((buyer) => ({
    ...buyer,
    name: shortenBuyerName(buyer.name),
    sampleCount: samples.filter((s) => s.buyer_id === buyer.id).length,
    contacts: contacts.filter((c) => c.buyer_id === buyer.id),
  }));
}

export async function createBuyer({ name }) {
  const { data, error } = await supabase.from('buyers').insert({ name }).select().single();
  if (error) throw error;
  return { ...data, name: shortenBuyerName(data.name) };
}

/**
 * Backs the merchant-contacts multi-select on both Add Buyer (addOnly)
 * and Edit Buyer (add + remove diff). A merchant profile only has one
 * `buyer_id`, so this is the single place that assignment gets made —
 * checking a merchant here both makes them a notification recipient
 * (`merchant_contacts`) AND sets their actual access scoping
 * (`profiles.buyer_id`); unchecking does the reverse, clearing buyer_id
 * only if it still points at *this* buyer (so it can't clobber a
 * reassignment made elsewhere in the meantime).
 */
export async function syncMerchantContacts({ buyerId, addProfileIds = [], removeProfileIds = [] }) {
  if (addProfileIds.length > 0) {
    const { error: insertErr } = await supabase
      .from('merchant_contacts')
      .insert(addProfileIds.map((profileId) => ({ buyer_id: buyerId, profile_id: profileId })));
    if (insertErr) throw insertErr;

    const { error: assignErr } = await supabase.from('profiles').update({ buyer_id: buyerId }).in('id', addProfileIds);
    if (assignErr) throw assignErr;
  }

  if (removeProfileIds.length > 0) {
    const { data: rows, error: selectErr } = await supabase
      .from('merchant_contacts')
      .select('id')
      .eq('buyer_id', buyerId)
      .in('profile_id', removeProfileIds);
    if (selectErr) throw selectErr;

    if (rows.length > 0) {
      const { error: deleteErr } = await supabase
        .from('merchant_contacts')
        .delete()
        .in('id', rows.map((r) => r.id));
      if (deleteErr) throw deleteErr;
    }

    const { error: unassignErr } = await supabase
      .from('profiles')
      .update({ buyer_id: null })
      .eq('buyer_id', buyerId)
      .in('id', removeProfileIds);
    if (unassignErr) throw unassignErr;
  }
}
