import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  total_value: number;
  pnl?: number;
  timestamp: number;
}

interface BacktestMetrics {
  totalPnl: number;
  winRate: number;
  avgPnl: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  sharpeRatio: number;
  maxConsecutiveLosses: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { tradingPair = 'BTCUSDT', interval = '1h', limit = 1000 } = await req.json();

    console.log(`Starting backtest for user ${user.id}, pair: ${tradingPair}`);

    // Fetch bot config
    const { data: config, error: configError } = await supabaseClient
      .from('bot_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('trading_pair', tradingPair)
      .single();

    if (configError || !config) {
      throw new Error('Bot config not found');
    }

    console.log('Bot config loaded:', config);

    // Fetch historical data from Binance
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${interval}&limit=${limit}`;
    const response = await fetch(binanceUrl);
    const candlesRaw = await response.json();

    const candles: OHLCVCandle[] = candlesRaw.map((c: any) => ({
      timestamp: c[0],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));

    console.log(`Fetched ${candles.length} candles`);

    // Run MA crossover strategy
    const trades = runMACrossoverBacktest(
      candles,
      config.short_ma_period,
      config.long_ma_period,
      config.trade_amount,
      config.stop_loss_percent,
      config.take_profit_percent
    );

    console.log(`Generated ${trades.length} trades`);

    // Calculate metrics
    const metrics = calculateBacktestMetrics(trades, config.trade_amount);

    // Store backtest run metadata
    const { error: runError } = await supabaseClient
      .from('backtest_runs')
      .insert({
        user_id: user.id,
        trading_pair: tradingPair,
        strategy_type: 'ma_crossover',
        total_pnl: metrics.totalPnl,
        win_rate: metrics.winRate,
        max_drawdown: metrics.maxDrawdown,
        avg_pnl: metrics.avgPnl,
        total_trades: metrics.totalTrades,
        config_snapshot: config,
      });

    if (runError) {
      console.error('Error storing backtest run:', runError);
    }

    // Store simulated trades (mark them as simulated)
    const tradesForDB = trades.map(t => ({
      user_id: user.id,
      trading_pair: tradingPair,
      trade_type: t.type,
      price: t.price,
      quantity: t.quantity,
      total_value: t.total_value,
      pnl: t.pnl || null,
      signal_type: 'ma_crossover',
      status: 'simulated',
      created_at: new Date(t.timestamp).toISOString(),
    }));

    if (tradesForDB.length > 0) {
      const { error: tradesError } = await supabaseClient
        .from('trades')
        .insert(tradesForDB);

      if (tradesError) {
        console.error('Error storing trades:', tradesError);
      }
    }

    // Store portfolio history snapshots
    let cumulativePnl = 0;
    const portfolioSnapshots = trades
      .filter(t => t.type === 'sell')
      .map(t => {
        cumulativePnl += t.pnl || 0;
        return {
          user_id: user.id,
          total_value: config.trade_amount + cumulativePnl,
          available_balance: config.trade_amount + cumulativePnl,
          total_pnl: cumulativePnl,
          in_position: false,
          recorded_at: new Date(t.timestamp).toISOString(),
        };
      });

    if (portfolioSnapshots.length > 0) {
      const { error: portfolioError } = await supabaseClient
        .from('portfolio_history')
        .insert(portfolioSnapshots);

      if (portfolioError) {
        console.error('Error storing portfolio history:', portfolioError);
      }
    }

    console.log('Backtest completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        metrics,
        trades: trades.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Backtest error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function movingAverage(data: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  const slice = data.slice(index - period + 1, index + 1);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function runMACrossoverBacktest(
  candles: OHLCVCandle[],
  shortPeriod: number,
  longPeriod: number,
  tradeAmount: number,
  stopLossPercent: number,
  takeProfitPercent: number
): Trade[] {
  const trades: Trade[] = [];
  const closes = candles.map(c => c.close);
  let inPosition = false;
  let entryPrice = 0;
  let entryIndex = 0;

  for (let i = 0; i < closes.length; i++) {
    const shortMA = movingAverage(closes, shortPeriod, i);
    const longMA = movingAverage(closes, longPeriod, i);
    const prevShortMA = movingAverage(closes, shortPeriod, i - 1);
    const prevLongMA = movingAverage(closes, longPeriod, i - 1);

    if (!shortMA || !longMA || !prevShortMA || !prevLongMA) continue;

    const currentPrice = closes[i];

    // Check stop loss / take profit if in position
    if (inPosition) {
      const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      if (priceChange <= -stopLossPercent || priceChange >= takeProfitPercent) {
        // Exit position due to stop loss or take profit
        const quantity = tradeAmount / entryPrice;
        const pnl = (currentPrice - entryPrice) * quantity;
        trades.push({
          type: 'sell',
          price: currentPrice,
          quantity,
          total_value: quantity * currentPrice,
          pnl,
          timestamp: candles[i].timestamp,
        });
        inPosition = false;
      }
    }

    // MA Crossover signals
    if (!inPosition && prevShortMA <= prevLongMA && shortMA > longMA) {
      // Bullish crossover - BUY
      inPosition = true;
      entryPrice = currentPrice;
      entryIndex = i;
      const quantity = tradeAmount / currentPrice;
      trades.push({
        type: 'buy',
        price: currentPrice,
        quantity,
        total_value: tradeAmount,
        timestamp: candles[i].timestamp,
      });
    } else if (inPosition && prevShortMA >= prevLongMA && shortMA < longMA) {
      // Bearish crossover - SELL
      const quantity = tradeAmount / entryPrice;
      const pnl = (currentPrice - entryPrice) * quantity;
      trades.push({
        type: 'sell',
        price: currentPrice,
        quantity,
        total_value: quantity * currentPrice,
        pnl,
        timestamp: candles[i].timestamp,
      });
      inPosition = false;
    }
  }

  return trades;
}

function calculateBacktestMetrics(trades: Trade[], initialBalance: number): BacktestMetrics {
  const completedTrades = [];
  
  for (let i = 0; i < trades.length; i += 2) {
    if (trades[i + 1] && trades[i].type === 'buy' && trades[i + 1].type === 'sell') {
      completedTrades.push({
        entry: trades[i],
        exit: trades[i + 1],
        pnl: trades[i + 1].pnl || 0,
      });
    }
  }

  const pnlList = completedTrades.map(t => t.pnl);
  const totalPnl = pnlList.reduce((a, b) => a + b, 0);
  const winningTrades = pnlList.filter(p => p > 0);
  const losingTrades = pnlList.filter(p => p <= 0);
  const winRate = pnlList.length > 0 ? winningTrades.length / pnlList.length : 0;
  const avgPnl = pnlList.length > 0 ? totalPnl / pnlList.length : 0;

  // Calculate max drawdown
  let peak = initialBalance;
  let maxDrawdown = 0;
  let currentBalance = initialBalance;
  
  for (const pnl of pnlList) {
    currentBalance += pnl;
    if (currentBalance > peak) {
      peak = currentBalance;
    }
    const drawdown = peak - currentBalance;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Calculate Sharpe ratio (simplified)
  const returns = pnlList.map(p => p / initialBalance);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev !== 0 ? avgReturn / stdDev : 0;

  // Max consecutive losses
  let maxConsecutiveLosses = 0;
  let currentConsecutiveLosses = 0;
  
  for (const pnl of pnlList) {
    if (pnl <= 0) {
      currentConsecutiveLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
    } else {
      currentConsecutiveLosses = 0;
    }
  }

  return {
    totalPnl,
    winRate,
    avgPnl,
    maxDrawdown,
    totalTrades: completedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    sharpeRatio,
    maxConsecutiveLosses,
  };
}
