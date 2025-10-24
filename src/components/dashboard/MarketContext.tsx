import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MarketContextProps {
  userId: string;
}

interface ContextData {
  regime: string;
  volatility: number;
  sentiment: number;
  trend_strength: number;
  rsi: number;
  atr: number;
  macd: number;
  signal: number;
  adx: number;
}

export const MarketContext = ({ userId }: MarketContextProps) => {
  const [context, setContext] = useState<ContextData | null>(null);

  useEffect(() => {
    fetchContext();
    
    const channel = supabase
      .channel('market-context-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_context',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setContext(payload.new as ContextData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchContext = async () => {
    const { data } = await supabase
      .from("market_context")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setContext(data as ContextData);
    }
  };

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'bullish': return 'bg-success text-success-foreground';
      case 'bearish': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRegimeIcon = (regime: string) => {
    switch (regime) {
      case 'bullish': return <TrendingUp className="w-4 h-4" />;
      case 'bearish': return <TrendingDown className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  if (!context) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Market Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No market data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Market Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Market Regime</span>
          <Badge className={`${getRegimeColor(context.regime)} flex items-center gap-1`}>
            {getRegimeIcon(context.regime)}
            {context.regime.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Volatility</p>
            <p className="text-sm font-medium">{context.volatility?.toFixed(2)}%</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sentiment</p>
            <p className="text-sm font-medium" style={{ color: context.sentiment >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
              {context.sentiment?.toFixed(2)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">RSI</p>
            <p className="text-sm font-medium">{context.rsi?.toFixed(2)}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ADX</p>
            <p className="text-sm font-medium">{context.adx?.toFixed(2)}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ATR</p>
            <p className="text-sm font-medium">{context.atr?.toFixed(4)}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">MACD</p>
            <p className="text-sm font-medium">{context.macd?.toFixed(2)}</p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Trend Strength</span>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(context.trend_strength, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};