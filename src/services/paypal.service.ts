import { paypal, PAYPAL_API } from '../config/paypal';
import axios from 'axios';

// ── Tips / Donations (Orders API v2) ─────────────────────────────────────

export async function createTipOrder(amount: number, returnUrl: string, cancelUrl: string, currency = 'USD') {
  const { data } = await paypal.post('/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: currency, value: amount.toFixed(2) },
      description: 'Tip / Donation',
    }],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: 'PAY_NOW',
    },
  });
  return data;
}

export async function captureTipOrder(orderId: string) {
  const { data } = await paypal.post(`/v2/checkout/orders/${orderId}/capture`, {});
  return data;
}

// ── Subscriptions (Billing API v1) ───────────────────────────────────────

export async function createSubscription(planId: string, returnUrl: string, cancelUrl: string) {
  const { data } = await paypal.post('/v1/billing/subscriptions', {
    plan_id: planId,
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: 'SUBSCRIBE_NOW',
    },
  });
  return data;
}

export async function cancelSubscription(subscriptionId: string) {
  await paypal.post(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    reason: 'Canceled by user',
  });
}

export async function getSubscriptionDetails(subscriptionId: string) {
  const { data } = await paypal.get(`/v1/billing/subscriptions/${subscriptionId}`);
  return data;
}

// ── Payouts (Payments API v1) ─────────────────────────────────────────

export async function sendPayout(email: string, amount: number, note: string, senderItemId: string) {
  const { data } = await paypal.post('/v1/payments/payouts', {
    sender_batch_header: {
      email_subject: 'Kotoba - Has recibido un pago',
      email_message: 'Tu saldo de Kotoba ha sido transferido a tu cuenta de PayPal.',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: amount.toFixed(2),
          currency: 'USD',
        },
        receiver: email,
        note,
        sender_item_id: senderItemId,
      },
    ],
  });
  return data;
}

export async function verifyWebhookSignature(headers: Record<string, string>, body: any): Promise<boolean> {
  try {
    const { data } = await axios.post(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID!,
        webhook_event: body,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getDirectToken()}`,
        },
      },
    );
    return data.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

async function getDirectToken(): Promise<string> {
  const { data } = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: process.env.PAYPAL_CLIENT_ID!,
        password: process.env.PAYPAL_CLIENT_SECRET!,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );
  return data.access_token;
}
