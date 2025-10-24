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

    // Helper function to log events
    const logEvent = async (level: string, eventType: string, message: string, metadata?: any) => {
      await supabase.from('bot_logs').insert({
        user_id: user.id,
        level,
        event_type: eventType,
        message,
        metadata
      });
    };

    // Log engine start
    await logEvent('info', 'engine_start', `Trading engine started for ${config.trading_pair}`);

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
      await logEvent('error', 'context_storage', 'Failed to store market context', { error: contextError.message });
    }

    // Check daily loss limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayTrades } = await supabase
      .from('trades')
      .select('pnl')
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());
    
    const todayPnL = todayTrades?.reduce((sum, t) => sum + (parseFloat(t.pnl?.toString() || '0')), 0) || 0;
    
    if (Math.abs(todayPnL) >= config.max_daily_loss) {
      await logEvent('warn', 'safety_limit', `Daily loss limit reached: $${Math.abs(todayPnL).toFixed(2)}. Bot paused.`);
      
      // Disable bot
      await supabase
        .from('bot_config')
        .update({ is_active: false })
        .eq('user_id', user.id);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Daily loss limit reached. Bot automatically paused.',
          todayPnL 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trading decision logic with context-awareness
    let action = 'hold';
    let reason = '';
    let adjustedTradeAmount = config.trade_amount;

    // Context-aware position sizing
    if (volatility > 3) {
      adjustedTradeAmount *= 0.5; // Reduce size in high volatility
      await logEvent('info', 'risk_adjustment', `High volatility detected (${volatility.toFixed(2)}%). Position size reduced by 50%.`);
    }
    
    if (sentiment < -0.5) {
      adjustedTradeAmount *= 0.7; // Reduce size in negative sentiment
      await logEvent('info', 'risk_adjustment', `Negative sentiment detected (${sentiment.toFixed(2)}). Position size reduced by 30%.`);
    }

    // Check safety conditions
    const volatilityOk = volatility < 8; // Max 8% volatility
    const trendStrong = adx > 20; // ADX above 20 indicates trend

    // Get current position
    const { data: lastTrade } = await supabase
      .from('trades')
      .select('trade_type, price, quantity')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const inPosition = lastTrade?.trade_type === 'buy';
    
    // Check stop loss and take profit
    if (inPosition && lastTrade) {
      const entryPrice = parseFloat(lastTrade.price.toString());
      const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      if (priceChange <= -config.stop_loss_percent) {
        action = 'sell';
        reason = `Stop loss triggered: ${priceChange.toFixed(2)}% loss`;
        await logEvent('warn', 'stop_loss', reason, { entryPrice, currentPrice, priceChange });
      } else if (priceChange >= config.take_profit_percent) {
        action = 'sell';
        reason = `Take profit triggered: ${priceChange.toFixed(2)}% gain`;
        await logEvent('info', 'take_profit', reason, { entryPrice, currentPrice, priceChange });
      }
    }

    // Strategy signals (only if no stop/TP triggered)
    if (action === 'hold' && volatilityOk) {
      if (regime === 'bullish' && !inPosition && trendStrong) {
        // Bullish regime with strong trend
        if (shortMA > longMA && rsi < 70 && rsi > 40 && macd > signal) {
          action = 'buy';
          reason = `Strong bullish signal: MA crossover + RSI(${rsi.toFixed(1)}) healthy + MACD bullish + ADX(${adx.toFixed(1)}) trending`;
        }
      } else if (regime === 'bearish' && inPosition) {
        // Bearish regime - exit position
        if (shortMA < longMA || rsi < 40 || macd < signal) {
          action = 'sell';
          reason = `Bearish signal: MA(${shortMA < longMA ? 'bearish cross' : ''}) RSI(${rsi.toFixed(1)}) MACD(${macd < signal ? 'bearish' : ''})`;
        }
      } else if (regime === 'range' && adx < 20) {
        // Range-bound market - mean reversion
        if (!inPosition && currentPrice <= bb.lower && rsi < 30) {
          action = 'buy';
          reason = `Range mean reversion: Price at lower BB(${bb.lower.toFixed(2)}) + RSI oversold(${rsi.toFixed(1)})`;
        } else if (inPosition && (currentPrice >= bb.upper || rsi > 70)) {
          action = 'sell';
          reason = `Range mean reversion exit: Price at upper BB(${bb.upper.toFixed(2)}) or RSI overbought(${rsi.toFixed(1)})`;
        }
      }
      
      // Additional exit condition for position holders
      if (inPosition && action === 'hold') {
        if (shortMA < longMA && rsi < 45) {
          action = 'sell';
          reason = 'Protective exit: MA crossover down + weakening momentum';
        }
      }
    } else if (!volatilityOk) {
      reason = `High volatility detected (${volatility.toFixed(2)}%). Waiting for calmer conditions.`;
      await logEvent('info', 'volatility_hold', reason);
    }

    // Execute trade if action is not hold
    if (action !== 'hold') {
      const quantity = adjustedTradeAmount / currentPrice;
      const totalValue = adjustedTradeAmount;

      await logEvent('info', 'trade_signal', `${action.toUpperCase()} signal generated: ${reason}`, {
        price: currentPrice,
        quantity,
        totalValue,
        indicators: { rsi, macd, volatility, regime }
      });

      // Calculate PnL for sell trades
      let tradePnL = 0;
      if (action === 'sell' && lastTrade) {
        const entryPrice = parseFloat(lastTrade.price.toString());
        const entryQty = parseFloat(lastTrade.quantity.toString());
        tradePnL = (currentPrice - entryPrice) * entryQty;
      }

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
          pnl: tradePnL,
          status: 'executed'
        });

      if (tradeError) {
        console.error('Error recording trade:', tradeError);
        await logEvent('error', 'trade_execution', 'Failed to record trade', { error: tradeError.message });
      } else {
        await logEvent('info', 'trade_executed', `${action.toUpperCase()} order executed at $${currentPrice.toFixed(2)}`, {
          quantity,
          totalValue
        });
      }

      // Update portfolio history
      const { data: lastPortfolio } = await supabase
        .from('portfolio_history')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let newBalance = lastPortfolio?.available_balance || 10000;
      let totalPnL = lastPortfolio?.total_pnl || 0;

      if (action === 'buy') {
        newBalance -= totalValue;
      } else {
        newBalance += totalValue;
        totalPnL += tradePnL;
      }

      const { error: portfolioError } = await supabase
        .from('portfolio_history')
        .insert({
          user_id: user.id,
          total_value: newBalance + (action === 'buy' ? totalValue : 0),
          available_balance: newBalance,
          in_position: action === 'buy',
          current_position_value: action === 'buy' ? totalValue : 0,
          total_pnl: totalPnL
        });

      if (portfolioError) {
        console.error('Error updating portfolio:', portfolioError);
        await logEvent('error', 'portfolio_update', 'Failed to update portfolio', { error: portfolioError.message });
      }
    } else {
      await logEvent('info', 'no_action', reason);
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