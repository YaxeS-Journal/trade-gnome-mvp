import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, AlertTriangle, BarChart3, Activity } from "lucide-react";

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

interface BacktestResultsProps {
  metrics: BacktestMetrics | null;
}

export const BacktestResults = ({ metrics }: BacktestResultsProps) => {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backtest Results</CardTitle>
          <CardDescription>
            Run a backtest to see historical performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No backtest results yet. Click "Run Backtest" to simulate your strategy on historical data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isProfitable = metrics.totalPnl > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Backtest Results
        </CardTitle>
        <CardDescription>
          Strategy performance on historical data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Total PnL */}
          <div className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              {isProfitable ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span>Total P&L</span>
            </div>
            <div className={`text-2xl font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
              ${metrics.totalPnl.toFixed(2)}
            </div>
          </div>

          {/* Win Rate */}
          <div className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="w-4 h-4" />
              <span>Win Rate</span>
            </div>
            <div className="text-2xl font-bold">
              {(metrics.winRate * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.winningTrades}W / {metrics.losingTrades}L
            </div>
          </div>

          {/* Total Trades */}
          <div className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Activity className="w-4 h-4" />
              <span>Total Trades</span>
            </div>
            <div className="text-2xl font-bold">
              {metrics.totalTrades}
            </div>
          </div>

          {/* Average PnL */}
          <div className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BarChart3 className="w-4 h-4" />
              <span>Avg P&L per Trade</span>
            </div>
            <div className={`text-2xl font-bold ${metrics.avgPnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${metrics.avgPnl.toFixed(2)}
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span>Max Drawdown</span>
            </div>
            <div className="text-2xl font-bold text-orange-500">
              ${metrics.maxDrawdown.toFixed(2)}
            </div>
          </div>

          {/* Sharpe Ratio */}
          <div className="flex flex-col gap-1 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Sharpe Ratio</span>
            </div>
            <div className="text-2xl font-bold">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Max losses: {metrics.maxConsecutiveLosses}
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="mt-6 p-4 rounded-lg bg-muted">
          <h4 className="font-semibold mb-2">Performance Summary</h4>
          <p className="text-sm text-muted-foreground">
            {isProfitable ? (
              <>
                Your MA crossover strategy achieved a <strong className="text-green-500">{(metrics.winRate * 100).toFixed(1)}%</strong> win rate 
                with a total profit of <strong className="text-green-500">${metrics.totalPnl.toFixed(2)}</strong> over {metrics.totalTrades} trades.
                {metrics.sharpeRatio > 1 && " The Sharpe ratio indicates good risk-adjusted returns."}
                {metrics.maxDrawdown < 50 && " Low drawdown suggests moderate risk exposure."}
              </>
            ) : (
              <>
                Your strategy resulted in a loss of <strong className="text-red-500">${Math.abs(metrics.totalPnl).toFixed(2)}</strong> with 
                a <strong>{(metrics.winRate * 100).toFixed(1)}%</strong> win rate. 
                Consider adjusting parameters or trying different market conditions.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
