import { supabase } from '@/shared/lib/supabaseClient';

export async function listBuyers() {
  const { data, error } = await supabase.from('buyers').select('*').order('name');
  if (error) throw error;
  return data;
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
    sampleCount: samples.filter((s) => s.buyer_id === buyer.id).length,
    contacts: contacts.filter((c) => c.buyer_id === buyer.id),
  }));
}

export async function createBuyer({ name }) {
  const { data, error } = await supabase.from('buyers').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function addMerchantContact({ buyerId, profileId }) {
  const { data, error } = await supabase
    .from('merchant_contacts')
    .insert({ buyer_id: buyerId, profile_id: profileId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeMerchantContact(id) {
  const { error } = await supabase.from('merchant_contacts').delete().eq('id', id);
  if (error) throw error;
}
