import { supabase } from '../config/supabase';

export async function getBalance(authorId: string) {
  const { data, error } = await supabase
    .from('author_balances')
    .select('*')
    .eq('author_id', authorId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || { author_id: authorId, balance: 0, total_earned: 0, total_paid_out: 0 };
}

export async function addTipToBalance(authorId: string, amount: number) {
  const { data, error } = await supabase.rpc('add_to_author_balance', {
    p_author_id: authorId,
    p_amount: amount,
  });

  if (error) {
    // Fallback: upsert manually if RPC not created yet
    const existing = await getBalance(authorId);
    if (existing.balance === 0 && existing.total_earned === 0) {
      const { error: insertError } = await supabase
        .from('author_balances')
        .insert({ author_id: authorId, balance: amount, total_earned: amount });
      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await supabase
        .from('author_balances')
        .update({
          balance: existing.balance + amount,
          total_earned: existing.total_earned + amount,
        })
        .eq('author_id', authorId);
      if (updateError) throw updateError;
    }
  }

  return getBalance(authorId);
}
