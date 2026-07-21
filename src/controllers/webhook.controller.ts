import { Request, Response } from 'express';
import * as paypalService from '../services/paypal.service';
import * as subscriptionModel from '../models/subscription.model';
import * as transactionModel from '../models/transaction.model';

// POST /api/webhooks/paypal
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const headers = {
      'paypal-auth-algo': req.headers['paypal-auth-algo'] as string,
      'paypal-cert-url': req.headers['paypal-cert-url'] as string,
      'paypal-transmission-id': req.headers['paypal-transmission-id'] as string,
      'paypal-transmission-sig': req.headers['paypal-transmission-sig'] as string,
      'paypal-transmission-time': req.headers['paypal-transmission-time'] as string,
    };

    const isValid = await paypalService.verifyWebhookSignature(headers, req.body);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const eventType = req.body.event_type;

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subId = req.body.resource?.id;
        if (subId) {
          const details = await paypalService.getSubscriptionDetails(subId);
          await subscriptionModel.createSubscription({
            userId: '', // will be updated once we map the subscriber
            paypalSubscriptionId: subId,
            planId: details.plan_id,
            status: 'active',
            periodStart: details.billing_info?.last_payment?.time,
            periodEnd: details.billing_info?.next_billing_time,
          });
          await transactionModel.updateTransactionBySubscriptionId(subId, { status: 'active' });
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const cancelledId = req.body.resource?.id;
        if (cancelledId) {
          await subscriptionModel.cancelSubscriptionInDb(cancelledId);
          await transactionModel.updateTransactionBySubscriptionId(cancelledId, { status: 'canceled' });
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const failedId = req.body.resource?.id;
        if (failedId) {
          await subscriptionModel.updateSubscriptionByPaypalId(failedId, { status: 'past_due' });
        }
        break;
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        const billingToken = req.body.resource?.billing_agreement_id;
        if (billingToken) {
          await transactionModel.updateTransactionBySubscriptionId(billingToken, { status: 'completed' });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('webhook error:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
