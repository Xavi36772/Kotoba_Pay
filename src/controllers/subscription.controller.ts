import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as paypalService from '../services/paypal.service';
import * as subscriptionModel from '../models/subscription.model';
import * as transactionModel from '../models/transaction.model';

// POST /api/payments/subscription/create
export async function createSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
      res.status(400).json({ error: 'planId is required' });
      return;
    }

    const returnUrl = `${req.headers.origin || 'https://kotoba.app'}/payments/success`;
    const cancelUrl = `${req.headers.origin || 'https://kotoba.app'}/payments/cancel`;

    const subscription = await paypalService.createSubscription(planId, returnUrl, cancelUrl);

    await transactionModel.createTransaction({
      userId,
      type: 'subscription',
      amount: 0, // amount handled by PayPal billing
      paypalSubscriptionId: subscription.id,
      status: 'pending',
    });

    res.json({
      subscriptionID: subscription.id,
      approvalUrl: subscription.links?.find((l: any) => l.rel === 'approve')?.href,
    });
  } catch (err: any) {
    console.error('createSubscription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
}

// POST /api/payments/subscription/cancel
export async function cancelSubscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user.id;
    const sub = await subscriptionModel.getActiveSubscription(userId);

    if (!sub) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    await paypalService.cancelSubscription(sub.paypal_subscription_id);
    await subscriptionModel.cancelSubscriptionInDb(sub.paypal_subscription_id);

    res.json({ status: 'canceled' });
  } catch (err: any) {
    console.error('cancelSubscription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}

// GET /api/payments/subscription/:userId
export async function getSubscriptionStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.params.userId || req.user.id;
    const sub = await subscriptionModel.getActiveSubscription(userId);

    if (!sub) {
      res.json({ active: false });
      return;
    }

    res.json({ active: true, subscription: sub });
  } catch (err: any) {
    console.error('getSubscriptionStatus error:', err.message);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
}
