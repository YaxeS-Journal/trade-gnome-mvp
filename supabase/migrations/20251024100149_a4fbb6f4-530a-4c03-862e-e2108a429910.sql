-- Create backtest_runs table to track backtest metadata
CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trading_pair TEXT NOT NULL,
  strategy_type TEXT NOT NULL DEFAULT 'ma_crossover',
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  avg_pnl NUMERIC NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  config_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own backtest runs"
ON public.backtest_runs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backtest runs"
ON public.backtest_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_backtest_runs_user_id ON public.backtest_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_created_at ON public.backtest_runs(created_at DESC);