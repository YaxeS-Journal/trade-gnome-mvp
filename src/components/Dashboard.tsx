import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { BotStatus } from "./dashboard/BotStatus";
import { StrategyConfig } from "./dashboard/StrategyConfig";
import { TradeHistory } from "./dashboard/TradeHistory";
import { PortfolioChart } from "./dashboard/PortfolioChart";
import { ExchangeSetup } from "./dashboard/ExchangeSetup";
import { MarketContext } from "./dashboard/MarketContext";
import { BotLogs } from "./dashboard/BotLogs";
import { BacktestResults } from "./dashboard/BacktestResults";
import { Button } from "./ui/button";
import { LogOut, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [backtestMetrics, setBacktestMetrics] = useState<any>(null);
  const [isRunningBacktest, setIsRunningBacktest] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const handleRunBacktest = async () => {
    if (!user) return;
    
    setIsRunningBacktest(true);
    toast.info("Starting backtest simulation...");

    try {
      const { data, error } = await supabase.functions.invoke('backtest', {
        body: {
          tradingPair: 'BTCUSDT',
          interval: '1h',
          limit: 1000,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setBacktestMetrics(data.metrics);
        toast.success(`Backtest complete! ${data.trades} trades simulated`);
      }
    } catch (error) {
      console.error('Backtest error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run backtest');
    } finally {
      setIsRunningBacktest(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Trading Bot Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated trading with moving average crossover strategy
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRunBacktest}
              disabled={isRunningBacktest}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {isRunningBacktest ? "Running..." : "Run Backtest"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <BotStatus userId={user.id} />
          <MarketContext userId={user.id} />
          <ExchangeSetup userId={user.id} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <StrategyConfig userId={user.id} />
          <PortfolioChart userId={user.id} />
        </div>

        <BacktestResults metrics={backtestMetrics} />

        <TradeHistory userId={user.id} />

        <BotLogs userId={user.id} />
      </div>
    </div>
  );
};