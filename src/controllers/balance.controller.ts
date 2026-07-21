import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getSupabase } from '../config/supabase';

// PUT /api/payments/paypal-email — save author's PayPal email
export async function setPaypalEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('users')
      .update({ paypal_email: email })
      .eq('id', userId);

    if (error) {
      console.error('setPaypalEmail error:', error);
      res.status(500).json({ error: 'Failed to save PayPal email' });
      return;
    }

    res.json({ paypal_email: email });
  } catch (err: any) {
    console.error('setPaypalEmail error:', err.message);
    res.status(500).json({ error: 'Failed to save PayPal email' });
  }
}

// GET /api/payments/balance — get author's balance
export async function getBalance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user.id;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('author_balances')
      .select('*')
      .eq('author_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('getBalance error:', error);
      res.status(500).json({ error: 'Failed to get balance' });
      return;
    }

    res.json(data || { author_id: userId, balance: 0, total_earned: 0, total_paid_out: 0, pending_payout: 0 });
  } catch (err: any) {
    console.error('getBalance error:', err.message);
    res.status(500).json({ error: 'Failed to get balance' });
  }
}

// POST /api/payments/payout — request a payout
export async function requestPayout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user.id;
    const supabase = getSupabase();

    // Get current balance
    const { data: balance, error: balError } = await supabase
      .from('author_balances')
      .select('balance')
      .eq('author_id', userId)
      .single();

    if (balError || !balance || balance.balance <= 0) {
      res.status(400).json({ error: 'No balance available for payout' });
      return;
    }

    // Move balance to pending_payout
    const { error: updateError } = await supabase
      .from('author_balances')
      .update({
        pending_payout: balance.balance,
        balance: 0,
      })
      .eq('author_id', userId);

    if (updateError) {
      console.error('requestPayout error:', updateError);
      res.status(500).json({ error: 'Failed to request payout' });
      return;
    }

    res.json({ status: 'requested', amount: balance.balance });
  } catch (err: any) {
    console.error('requestPayout error:', err.message);
    res.status(500).json({ error: 'Failed to request payout' });
  }
}
