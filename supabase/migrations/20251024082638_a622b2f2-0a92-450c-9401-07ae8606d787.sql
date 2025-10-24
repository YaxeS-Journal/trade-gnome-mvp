-- Create trading bot configuration table
CREATE TABLE public.bot_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL DEFAULT 'binance',
  trading_pair TEXT NOT NULL DEFAULT 'BTCUSDT',
  strategy_type TEXT NOT NULL DEFAULT 'ma_crossover',
  short_ma_period INTEGER NOT NULL DEFAULT 10,
  long_ma_period INTEGER NOT NULL DEFAULT 50,
  trade_amount DECIMAL NOT NULL DEFAULT 100,
  stop_loss_percent DECIMAL NOT NULL DEFAULT 2,
  take_profit_percent DECIMAL NOT NULL DEFAULT 5,
  max_daily_loss DECIMAL NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trades table
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trading_pair TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  price DECIMAL NOT NULL,
  quantity DECIMAL NOT NULL,
  total_value DECIMAL NOT NULL,
  signal_type TEXT NOT NULL,
  pnl DECIMAL,
  status TEXT NOT NULL DEFAULT 'executed' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
  exchange_order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create portfolio history table
CREATE TABLE public.portfolio_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_value DECIMAL NOT NULL,
  available_balance DECIMAL NOT NULL,
  in_position BOOLEAN NOT NULL DEFAULT false,
  current_position_value DECIMAL,
  total_pnl DECIMAL NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bot_config
CREATE POLICY "Users can view their own bot config"
  ON public.bot_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bot config"
  ON public.bot_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bot config"
  ON public.bot_config FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for trades
CREATE POLICY "Users can view their own trades"
  ON public.trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades"
  ON public.trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for portfolio_history
CREATE POLICY "Users can view their own portfolio history"
  ON public.portfolio_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio history"
  ON public.portfolio_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bot_config_updated_at
  BEFORE UPDATE ON public.bot_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for trades and portfolio
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_config;