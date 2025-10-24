import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { BotStatus } from "./dashboard/BotStatus";
import { StrategyConfig } from "./dashboard/StrategyConfig";
import { TradeHistory } from "./dashboard/TradeHistory";
import { PortfolioChart } from "./dashboard/PortfolioChart";
import { ExchangeSetup } from "./dashboard/ExchangeSetup";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
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
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <ExchangeSetup userId={user.id} />

        <div className="grid gap-6 md:grid-cols-2">
          <BotStatus userId={user.id} />
          <StrategyConfig userId={user.id} />
        </div>

        <PortfolioChart userId={user.id} />

        <TradeHistory userId={user.id} />
      </div>
    </div>
  );
};