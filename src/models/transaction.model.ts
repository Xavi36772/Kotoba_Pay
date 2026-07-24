import { getSupabase } from '../config/supabase';

export async function createTransaction(data: {
  userId: string;
  type: 'tip' | 'subscription' | 'payout';
  amount: number;
  currency?: string;
  paypalOrderId?: string;
  paypalSubscriptionId?: string;
  status?: string;
  authorId?: string;
}) {
  const supabase = getSupabase();
  const { data: tx, error } = await supabase
    .from('payment_transactions')
    .insert({
      user_id: data.userId,
      type: data.type,
      amount: data.amount,
      currency: data.currency || 'USD',
      paypal_order_id: data.paypalOrderId,
      paypal_subscription_id: data.paypalSubscriptionId,
      status: data.status || 'pending',
      author_id: data.authorId,
    })
    .select()
    .single();

  if (error) throw error;
  return tx;
}

export async function updateTransactionByOrderId(orderId: string, updates: Record<string, any>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payment_transactions')
    .update(updates)
    .eq('paypal_order_id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransactionBySubscriptionId(subscriptionId: string, updates: Record<string, any>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payment_transactions')
    .update(updates)
    .eq('paypal_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function findTransactionByOrderId(orderId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('paypal_order_id', orderId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getTransactionHistory(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
