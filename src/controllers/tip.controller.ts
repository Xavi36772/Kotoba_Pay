import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as paypalService from '../services/paypal.service';
import * as transactionModel from '../models/transaction.model';
import * as balanceModel from '../models/balance.model';

// POST /api/payments/tip — create PayPal order for a tip
export async function createTip(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { amount, authorId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    if (!authorId) {
      res.status(400).json({ error: 'authorId is required' });
      return;
    }

    const order = await paypalService.createTipOrder(amount);

    await transactionModel.createTransaction({
      userId,
      type: 'tip',
      amount,
      paypalOrderId: order.id,
      authorId,
    });

    const paypalBase = process.env.PAYPAL_MODE === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
    const checkoutUrl = `${paypalBase}/checkoutnow?token=${order.id}`;
    res.json({ orderID: order.id, checkoutUrl });
  } catch (err: any) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('createTip error:', detail);
    res.status(500).json({ error: detail.substring(0, 300) });
  }
}

// POST /api/payments/tip/capture — capture an approved PayPal order
export async function captureTip(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }

    const capture = await paypalService.captureTipOrder(orderId);

    const status = capture.status === 'COMPLETED' ? 'completed' : 'failed';

    const tx = await transactionModel.updateTransactionByOrderId(orderId, { status });

    // Add to author balance if completed
    if (status === 'completed' && tx?.author_id) {
      await balanceModel.addTipToBalance(tx.author_id, tx.amount);
    }

    res.json({ status, capture });
  } catch (err: any) {
    console.error('captureTip error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to capture tip order' });
  }
}
