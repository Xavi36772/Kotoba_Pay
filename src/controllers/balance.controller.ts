import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getSupabase } from '../config/supabase';
import { sendPayout } from '../services/paypal.service';
import * as transactionModel from '../models/transaction.model';

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

    if (data) {
      res.json(data);
      return;
    }

    // Lazy reconciliation: calculate from completed transactions
    const { data: txs, error: txError } = await supabase
      .from('payment_transactions')
      .select('amount')
      .eq('author_id', userId)
      .eq('status', 'completed');

    if (txError) {
      console.error('getBalance tx error:', txError);
      res.json({ author_id: userId, balance: 0, total_earned: 0, total_paid_out: 0, pending_payout: 0 });
      return;
    }

    const totalEarned = (txs || []).reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

    // Auto-create balance record
    if (totalEarned > 0) {
      const { data: newBalance, error: insertError } = await supabase
        .from('author_balances')
        .insert({ author_id: userId, balance: totalEarned, total_earned: totalEarned })
        .select()
        .single();

      if (!insertError && newBalance) {
        res.json(newBalance);
        return;
      }
    }

    res.json({ author_id: userId, balance: 0, total_earned: 0, total_paid_out: 0, pending_payout: 0 });
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
      .select('balance, pending_payout')
      .eq('author_id', userId)
      .single();

    if (balError || !balance || balance.balance <= 0) {
      res.status(400).json({ error: 'No balance available for payout' });
      return;
    }

    // Get user's PayPal email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('paypal_email')
      .eq('id', userId)
      .single();

    if (userError || !user?.paypal_email) {
      res.status(400).json({ error: 'No PayPal email configured. Add it in Edit Profile.' });
      return;
    }

    const amount = balance.balance;
    const payoutId = `payout_${userId}_${Date.now()}`;

    // Send actual payout via PayPal Payouts API
    const payoutResult = await sendPayout(
      user.paypal_email,
      amount,
      'Pago de donaciones de Kotoba',
      payoutId,
    );

    const batchId = payoutResult?.batch_header?.payout_batch_id;

    if (!batchId) {
      res.status(500).json({ error: 'PayPal returned no batch ID' });
      return;
    }

    // Record payout transaction
    await transactionModel.createTransaction({
      userId,
      type: 'payout',
      amount: -amount,
      paypalOrderId: batchId,
      status: 'completed',
      authorId: userId,
    });

    // Deduct balance
    const { error: updateError } = await supabase
      .from('author_balances')
      .update({
        balance: 0,
        total_paid_out: (balance.pending_payout || 0) + amount,
        pending_payout: 0,
      })
      .eq('author_id', userId);

    if (updateError) {
      console.error('requestPayout balance update error:', updateError);
      // Payout was sent but we couldn't update balance — log for manual fix
    }

    res.json({ status: 'completed', amount, batchId });
  } catch (err: any) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('requestPayout error:', detail);
    res.status(500).json({ error: detail.substring(0, 400) });
  }
}
