import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Technical indicator calculations
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0;
  
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
  
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: middle + (2 * stdDev),
    middle,
    lower: middle - (2 * stdDev)
  };
}

function calculateMACD(prices: number[]): { macd: number; signal: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // Simplified signal line (would need more history for accurate calculation)
  const signal = macd * 0.9; // Approximation
  
  return { macd, signal };
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(-period, -period + 1)[0];
  
  for (let i = prices.length - period + 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0;
  
  // Simplified ADX calculation
  let sumDX = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const range = high - low;
    if (range > 0) sumDX += 25; // Simplified
  }
  
  return sumDX / period;
}

function detectSupportResistance(prices: number[]): { support: number; resistance: number } {
  const sorted = [...prices].sort((a, b) => a - b);
  const len = sorted.length;
  
  return {
    support: sorted[Math.floor(len * 0.2)],
    resistance: sorted[Math.floor(len * 0.8)]
  };
}

function determineRegime(trend: number, volatility: number): string {
  if (trend > 60) return 'bullish';
  if (trend < 40) return 'bearish';
  return 'range';
}

async function fetchCandles(pair: string, limit: number = 100): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=${limit}`
    );
    const data = await response.json();
    
    return data.map((candle: any) => ({
      time: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));
  } catch (error) {
    console.error('Error fetching candles:', error);
    return [];
  }
}

async function getSentiment(): Promise<number> {
  // Simulated sentiment (-1 to +1)
  // In production, integrate with a real sentiment API
  return Math.random() * 2 - 1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch bot configuration
    const { data: config, error: configError } = await supabase
      .from('bot_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      throw new Error('Bot configuration not found');
    }

    if (!config.is_active) {
      return new Response(
        JSON.stringify({ message: 'Bot is not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch historical candles
    const candles = await fetchCandles(config.trading_pair, 100);
    if (candles.length === 0) {
      throw new Error('Failed to fetch market data');
    }

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const currentPrice = closes[closes.length - 1];

    // Calculate indicators
    const shortMA = calculateSMA(closes, config.short_ma_period);
    const longMA = calculateSMA(closes, config.long_ma_period);
    const rsi = calculateRSI(closes);
    const atr = calculateATR(highs, lows, closes);
    const bb = calculateBollingerBands(closes);
    const { macd, signal } = calculateMACD(closes);
    const adx = calculateADX(highs, lows, closes);
    const { support, resistance } = detectSupportResistance(closes);

    // Calculate volatility (normalized ATR)
    const volatility = (atr / currentPrice) * 100;

    // Get sentiment
    const sentiment = await getSentiment();

    // Determine trend strength and regime
    const trendStrength = rsi;
    const regime = determineRegime(trendStrength, volatility);

    // Store market context
    const { error: contextError } = await supabase
      .from('market_context')
      .insert({
        user_id: user.id,
        pair: config.trading_pair,
        volatility,
        sentiment,
        trend_strength: trendStrength,
        regime,
        atr,
        rsi,
        macd,
        signal,
        adx,
        bb_upper: bb.upper,
        bb_lower: bb.lower,
        bb_middle: bb.middle,
        support_level: support,
        resistance_level: resistance
      });

    if (contextError) {
      console.error('Error storing market context:', contextError);
    }

    // Trading decision logic
    let action = 'hold';
    let reason = '';

    // Check safety conditions
    const volatilityOk = volatility < 5; // Less than 5% volatility
    const sentimentOk = sentiment >= 0;

    // Get current position
    const { data: lastTrade } = await supabase
      .from('trades')
      .select('trade_type, price')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const inPosition = lastTrade?.trade_type === 'buy';

    if (volatilityOk && sentimentOk) {
      if (regime === 'bullish' && !inPosition) {
        if (shortMA > longMA && rsi < 70) {
          action = 'buy';
          reason = 'Bullish regime + MA crossover + RSI not overbought';
        }
      } else if (regime === 'bearish' && inPosition) {
        if (shortMA < longMA && rsi > 30) {
          action = 'sell';
          reason = 'Bearish regime + MA crossover + RSI not oversold';
        }
      } else if (regime === 'range') {
        if (!inPosition && currentPrice <= bb.lower && rsi < 35) {
          action = 'buy';
          reason = 'Range-bound mean reversion: price at lower BB';
        } else if (inPosition && currentPrice >= bb.upper && rsi > 65) {
          action = 'sell';
          reason = 'Range-bound mean reversion: price at upper BB';
        }
      } else if (inPosition && shortMA < longMA) {
        action = 'sell';
        reason = 'Exit signal: MA crossover down';
      }
    } else {
      reason = `Safety check failed: volatility=${volatility.toFixed(2)}%, sentiment=${sentiment.toFixed(2)}`;
    }

    // Execute trade if action is not hold
    if (action !== 'hold') {
      const quantity = config.trade_amount / currentPrice;
      const totalValue = config.trade_amount;

      const { error: tradeError } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          trading_pair: config.trading_pair,
          trade_type: action,
          signal_type: config.strategy_type,
          price: currentPrice,
          quantity,
          total_value: totalValue,
          status: 'executed'
        });

      if (tradeError) {
        console.error('Error recording trade:', tradeError);
      }

      // Update portfolio history
      const { data: lastPortfolio } = await supabase
        .from('portfolio_history')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      let newBalance = lastPortfolio?.available_balance || 10000;
      let totalPnL = lastPortfolio?.total_pnl || 0;

      if (action === 'buy') {
        newBalance -= totalValue;
      } else {
        newBalance += totalValue;
        // Calculate PnL if we have entry price
        if (lastTrade?.price) {
          const pnl = (currentPrice - parseFloat(lastTrade.price)) * quantity;
          totalPnL += pnl;
        }
      }

      const { error: portfolioError } = await supabase
        .from('portfolio_history')
        .insert({
          user_id: user.id,
          total_value: newBalance,
          available_balance: newBalance,
          in_position: action === 'buy',
          current_position_value: action === 'buy' ? totalValue : 0,
          total_pnl: totalPnL
        });

      if (portfolioError) {
        console.error('Error updating portfolio:', portfolioError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        reason,
        indicators: {
          price: currentPrice,
          shortMA,
          longMA,
          rsi,
          atr,
          volatility,
          sentiment,
          regime,
          macd,
          signal,
          adx,
          bollingerBands: bb,
          support,
          resistance
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Trading engine error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});