import { supabase } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';

const RECALL_SELECT =
  '*, sample:samples(id, bt_code, product_name, hall_id, buyer_id, hall:halls(id, hall_number, name))';

export async function listRecalls() {
  const { data, error } = await supabase
    .from('recall_requests')
    .select(RECALL_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createRecall({ sample, reason, requestedById, merchantName }) {
  const { data, error } = await supabase
    .from('recall_requests')
    .insert({ sample_id: sample.id, requested_by: requestedById, reason: reason || null })
    .select(RECALL_SELECT)
    .single();
  if (error) throw error;

  sendNotification('recall', {
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallId: sample.hall_id,
    reason,
    merchantName,
  });

  return data;
}
