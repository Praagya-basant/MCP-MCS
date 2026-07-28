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
      supabase.from('samples').select('buyer_id, status'),
      supabase.from('merchant_contacts').select('id, buyer_id, profile:profiles(id, full_name, email)'),
    ]);

  if (buyersErr) throw buyersErr;
  if (samplesErr) throw samplesErr;
  if (contactsErr) throw contactsErr;

  return buyers.map((buyer) => ({
    ...buyer,
    name: shortenBuyerName(buyer.name),
    sampleCount: samples.filter((s) => s.buyer_id === buyer.id).length,
    issuedCount: samples.filter((s) => s.buyer_id === buyer.id && s.status === 'checked_out').length,
    contacts: contacts.filter((c) => c.buyer_id === buyer.id),
  }));
}

export async function createBuyer({ name }) {
  const { data, error } = await supabase.from('buyers').insert({ name }).select().single();
  if (error) throw error;
  return { ...data, name: shortenBuyerName(data.name) };
}

/**
 * Permanently deletes a buyer, all their samples, and all associated
 * movement/recall/comment history. None of those tables has a direct
 * DELETE policy, so this goes through the delete_buyer() SECURITY
 * DEFINER RPC (same pattern as delete_sample), which also rejects the
 * call server-side if any of the buyer's samples is currently issued.
 */
export async function deleteBuyer(buyerId) {
  const { error } = await supabase.rpc('delete_buyer', { p_buyer_id: buyerId });
  if (error) throw error;
}

/**
 * Backs Edit Buyer's merchant search-select (add + remove diff) — the
 * ONLY place buyer<->merchant assignment happens in the app. Checking a
 * merchant here both makes them a notification recipient
 * (`merchant_contacts`) and sets their access scoping, in both the
 * legacy single-buyer form (`profiles.buyer_id`) and the multi-buyer
 * form (`merchant_buyers`, see is_merchant_buyer() in schema.sql).
 * Unchecking does the reverse, clearing buyer_id only if it still points
 * at *this* buyer (so it can't clobber a reassignment made elsewhere).
 */
export async function syncMerchantContacts({ buyerId, addProfileIds = [], removeProfileIds = [] }) {
  if (addProfileIds.length > 0) {
    const { error: insertErr } = await supabase
      .from('merchant_contacts')
      .insert(addProfileIds.map((profileId) => ({ buyer_id: buyerId, profile_id: profileId })));
    if (insertErr) throw insertErr;

    const { error: assignErr } = await supabase.from('profiles').update({ buyer_id: buyerId }).in('id', addProfileIds);
    if (assignErr) throw assignErr;

    const { error: mergeErr } = await supabase
      .from('merchant_buyers')
      .upsert(
        addProfileIds.map((profileId) => ({ buyer_id: buyerId, profile_id: profileId })),
        { onConflict: 'profile_id,buyer_id', ignoreDuplicates: true }
      );
    if (mergeErr) throw mergeErr;
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

    const { error: unmergeErr } = await supabase
      .from('merchant_buyers')
      .delete()
      .eq('buyer_id', buyerId)
      .in('profile_id', removeProfileIds);
    if (unmergeErr) throw unmergeErr;
  }
}
