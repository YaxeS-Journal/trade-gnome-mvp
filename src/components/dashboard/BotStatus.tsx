import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Square, Activity, TrendingUp, TrendingDown } from "lucide-react";

interface BotStatusProps {
  userId: string;
}

export const BotStatus = ({ userId }: BotStatusProps) => {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalPnL: 0,
    todayPnL: 0,
    totalTrades: 0,
    inPosition: false,
  });

  useEffect(() => {
    fetchBotStatus();
    fetchStats();

    const channel = supabase
      .channel('bot-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_config',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchBotStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchBotStatus = async () => {
    const { data } = await supabase
      .from("bot_config")
      .select("is_active")
      .eq("user_id", userId)
      .single();

    if (data) {
      setIsActive(data.is_active);
    }
  };

  const fetchStats = async () => {
    const { data: trades } = await supabase
      .from("trades")
      .select("pnl, created_at")
      .eq("user_id", userId);

    const { data: portfolio } = await supabase
      .from("portfolio_history")
      .select("total_pnl, in_position")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (trades) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayTrades = trades.filter(
        (t) => new Date(t.created_at) >= today
      );

      setStats({
        totalPnL: portfolio?.total_pnl || 0,
        todayPnL: todayTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0),
        totalTrades: trades.length,
        inPosition: portfolio?.in_position || false,
      });
    }
  };

  const runTradingEngine = async () => {
    try {
      const { error } = await supabase.functions.invoke('trading-engine');
      
      if (error) {
        console.error('Trading engine error:', error);
        toast.error('Failed to run trading engine');
      } else {
        toast.success('Trading engine executed successfully');
      }
    } catch (error: any) {
      console.error('Trading engine error:', error);
      toast.error(error.message);
    }
  };

  const toggleBot = async () => {
    setLoading(true);
    try {
      const { data: config } = await supabase
        .from("bot_config")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!config) {
        toast.error("Please configure your strategy first");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("bot_config")
        .update({ is_active: !isActive })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success(`Bot ${!isActive ? "started" : "stopped"} successfully`);
      setIsActive(!isActive);

      // Run trading engine immediately when starting
      if (!isActive) {
        runTradingEngine();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Bot Status
        </CardTitle>
        <CardDescription>Control and monitor your trading bot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isActive ? "bg-success animate-pulse" : "bg-muted-foreground"
              }`}
            />
            <span className="font-medium">
              {isActive ? "Trading Active" : "Stopped"}
            </span>
          </div>
          <Button
            onClick={toggleBot}
            disabled={loading}
            variant={isActive ? "destructive" : "default"}
          >
            {isActive ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop Bot
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Bot
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              Total P&L
            </div>
            <div
              className={`text-2xl font-bold flex items-center gap-1 ${
                stats.totalPnL >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {stats.totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              ${Math.abs(stats.totalPnL).toFixed(2)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              Today's P&L
            </div>
            <div
              className={`text-2xl font-bold flex items-center gap-1 ${
                stats.todayPnL >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {stats.todayPnL >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              ${Math.abs(stats.todayPnL).toFixed(2)}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="text-sm text-muted-foreground mb-1">Total Trades</div>
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="text-sm text-muted-foreground mb-1">Position</div>
            <div className="text-2xl font-bold">
              {stats.inPosition ? "In Trade" : "No Position"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};