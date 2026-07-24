import { getSupabase } from '../config/supabase';

export async function getBalance(authorId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('author_balances')
    .select('*')
    .eq('author_id', authorId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || { author_id: authorId, balance: 0, total_earned: 0, total_paid_out: 0 };
}

export async function addTipToBalance(authorId: string, amount: number) {
  const supabase = getSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from('author_balances')
    .select('balance, total_earned')
    .eq('author_id', authorId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  if (existing) {
    const { error } = await supabase
      .from('author_balances')
      .update({
        balance: existing.balance + amount,
        total_earned: existing.total_earned + amount,
      })
      .eq('author_id', authorId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('author_balances')
      .insert({ author_id: authorId, balance: amount, total_earned: amount });
    if (error) throw error;
  }

  return getBalance(authorId);
}
