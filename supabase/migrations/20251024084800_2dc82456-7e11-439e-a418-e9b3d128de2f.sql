-- Create market_context table for storing derived technical analysis data
CREATE TABLE public.market_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL,
  pair text NOT NULL,
  volatility numeric,
  sentiment numeric,
  trend_strength numeric,
  regime text,
  atr numeric,
  rsi numeric,
  macd numeric,
  signal numeric,
  adx numeric,
  bb_upper numeric,
  bb_lower numeric,
  bb_middle numeric,
  support_level numeric,
  resistance_level numeric
);

-- Enable RLS
ALTER TABLE public.market_context ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own market context"
  ON public.market_context
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own market context"
  ON public.market_context
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_market_context_user_id ON public.market_context(user_id);
CREATE INDEX idx_market_context_recorded_at ON public.market_context(recorded_at DESC);