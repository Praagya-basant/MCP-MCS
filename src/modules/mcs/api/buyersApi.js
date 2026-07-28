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
 * Backs the merchant-contacts multi-select on both Add Buyer (addOnly)
 * and Edit Buyer (add + remove diff). A merchant profile only has one
 * legacy `buyer_id`, so this is the single place that assignment gets
 * made — checking a merchant here both makes them a notification
 * recipient (`merchant_contacts`) AND sets their legacy access scoping
 * (`profiles.buyer_id`); unchecking does the reverse, clearing buyer_id
 * only if it still points at *this* buyer (so it can't clobber a
 * reassignment made elsewhere in the meantime). Also mirrors both
 * directions into `merchant_buyers` — the new multi-buyer source of
 * truth (see is_merchant_buyer() in schema.sql) — so a merchant checked
 * here shows up correctly even if they already have other buyers
 * assigned via Edit User's multi-select.
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

/** All buyer ids currently assigned to a merchant via merchant_buyers (Edit User's multi-select). */
export async function listMerchantBuyerIds(profileId) {
  const { data, error } = await supabase.from('merchant_buyers').select('buyer_id').eq('profile_id', profileId);
  if (error) throw error;
  return data.map((r) => r.buyer_id);
}

/**
 * Replaces a merchant's full merchant_buyers set in one go — simpler than
 * diffing since Edit User's multi-select always submits the complete
 * desired list. Deliberately does NOT touch the legacy `profiles.buyer_id`
 * pointer (that stays whatever Admin -> Buyers set it to, if anything) —
 * merchant_buyers is additive, not a migration of the old field.
 */
export async function setMerchantBuyers({ profileId, buyerIds }) {
  const { error: deleteErr } = await supabase.from('merchant_buyers').delete().eq('profile_id', profileId);
  if (deleteErr) throw deleteErr;

  if (buyerIds.length > 0) {
    const { error: insertErr } = await supabase
      .from('merchant_buyers')
      .insert(buyerIds.map((buyerId) => ({ profile_id: profileId, buyer_id: buyerId })));
    if (insertErr) throw insertErr;
  }
}
