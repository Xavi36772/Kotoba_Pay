import { supabase } from '../config/supabase';

export async function createSubscription(data: {
  userId: string;
  paypalSubscriptionId: string;
  planId: string;
  status?: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: data.userId,
      paypal_subscription_id: data.paypalSubscriptionId,
      plan_id: data.planId,
      status: data.status || 'active',
      current_period_start: data.periodStart,
      current_period_end: data.periodEnd,
    })
    .select()
    .single();

  if (error) throw error;
  return sub;
}

export async function getActiveSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function cancelSubscriptionInDb(subscriptionId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('paypal_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubscriptionByPaypalId(paypalId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('paypal_subscription_id', paypalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
