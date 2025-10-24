import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings } from "lucide-react";

interface StrategyConfigProps {
  userId: string;
}

export const StrategyConfig = ({ userId }: StrategyConfigProps) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    trading_pair: "BTCUSDT",
    short_ma_period: 10,
    long_ma_period: 50,
    trade_amount: 100,
    stop_loss_percent: 2,
    take_profit_percent: 5,
    max_daily_loss: 100,
  });

  useEffect(() => {
    fetchConfig();
  }, [userId]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("bot_config")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      setConfig({
        trading_pair: data.trading_pair,
        short_ma_period: data.short_ma_period,
        long_ma_period: data.long_ma_period,
        trade_amount: Number(data.trade_amount),
        stop_loss_percent: Number(data.stop_loss_percent),
        take_profit_percent: Number(data.take_profit_percent),
        max_daily_loss: Number(data.max_daily_loss),
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("bot_config")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("bot_config")
          .update(config)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bot_config")
          .insert({ ...config, user_id: userId });

        if (error) throw error;
      }

      toast.success("Strategy configuration saved!");
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
          <Settings className="w-5 h-5" />
          Strategy Configuration
        </CardTitle>
        <CardDescription>Moving Average Crossover parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="trading_pair">Trading Pair</Label>
          <Input
            id="trading_pair"
            value={config.trading_pair}
            onChange={(e) =>
              setConfig({ ...config, trading_pair: e.target.value })
            }
            placeholder="BTCUSDT"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="short_ma">Short MA Period</Label>
            <Input
              id="short_ma"
              type="number"
              value={config.short_ma_period}
              onChange={(e) =>
                setConfig({ ...config, short_ma_period: parseInt(e.target.value) })
              }
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="long_ma">Long MA Period</Label>
            <Input
              id="long_ma"
              type="number"
              value={config.long_ma_period}
              onChange={(e) =>
                setConfig({ ...config, long_ma_period: parseInt(e.target.value) })
              }
              min="1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="trade_amount">Trade Amount ($)</Label>
          <Input
            id="trade_amount"
            type="number"
            value={config.trade_amount}
            onChange={(e) =>
              setConfig({ ...config, trade_amount: parseFloat(e.target.value) })
            }
            min="0"
            step="0.01"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stop_loss">Stop Loss (%)</Label>
            <Input
              id="stop_loss"
              type="number"
              value={config.stop_loss_percent}
              onChange={(e) =>
                setConfig({
                  ...config,
                  stop_loss_percent: parseFloat(e.target.value),
                })
              }
              min="0"
              step="0.1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="take_profit">Take Profit (%)</Label>
            <Input
              id="take_profit"
              type="number"
              value={config.take_profit_percent}
              onChange={(e) =>
                setConfig({
                  ...config,
                  take_profit_percent: parseFloat(e.target.value),
                })
              }
              min="0"
              step="0.1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_daily_loss">Max Daily Loss ($)</Label>
          <Input
            id="max_daily_loss"
            type="number"
            value={config.max_daily_loss}
            onChange={(e) =>
              setConfig({ ...config, max_daily_loss: parseFloat(e.target.value) })
            }
            min="0"
            step="0.01"
          />
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
};