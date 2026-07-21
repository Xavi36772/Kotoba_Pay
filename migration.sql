-- ══════════════════════════════════════════════════════════════════════════════
-- Payment Service — SQL Migration
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Payment transactions (tips + subscriptions + payouts)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('tip', 'subscription', 'payout')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  paypal_order_id TEXT,
  paypal_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order ON payment_transactions(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_sub ON payment_transactions(paypal_subscription_id);

-- 2. Recurring subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  paypal_subscription_id TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  canceled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal ON subscriptions(paypal_subscription_id);

-- 3. Author balances (earnings from tips)
CREATE TABLE IF NOT EXISTS author_balances (
  author_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  balance NUMERIC(10,2) DEFAULT 0 NOT NULL,
  total_earned NUMERIC(10,2) DEFAULT 0 NOT NULL,
  total_paid_out NUMERIC(10,2) DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Helper RPC to atomically add to author balance
CREATE OR REPLACE FUNCTION public.add_to_author_balance(p_author_id UUID, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.author_balances (author_id, balance, total_earned)
  VALUES (p_author_id, p_amount, p_amount)
  ON CONFLICT (author_id)
  DO UPDATE SET
    balance = public.author_balances.balance + p_amount,
    total_earned = public.author_balances.total_earned + p_amount,
    updated_at = now();
END;
$$;

-- RLS: payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
  ON payment_transactions FOR UPDATE
  USING (true);

-- RLS: subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (true);

-- RLS: author_balances
ALTER TABLE author_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view author balances"
  ON author_balances FOR SELECT
  USING (true);

CREATE POLICY "Service role can update balances"
  ON author_balances FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update balances"
  ON author_balances FOR UPDATE
  USING (true);
