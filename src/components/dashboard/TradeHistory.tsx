import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpCircle, ArrowDownCircle, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TradeHistoryProps {
  userId: string;
}

export const TradeHistory = ({ userId }: TradeHistoryProps) => {
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    fetchTrades();

    const channel = supabase
      .channel('trades-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchTrades()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchTrades = async () => {
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setTrades(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Trade History
        </CardTitle>
        <CardDescription>Your recent trading activity</CardDescription>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No trades yet. Start your bot to begin trading!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {trade.trade_type === "buy" ? (
                          <ArrowUpCircle className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-destructive" />
                        )}
                        <span className="capitalize font-medium">
                          {trade.trade_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{trade.trading_pair}</TableCell>
                    <TableCell className="font-mono">
                      ${Number(trade.price).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {Number(trade.quantity).toFixed(6)}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${Number(trade.total_value).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {trade.pnl !== null ? (
                        <span
                          className={`font-mono font-medium ${
                            Number(trade.pnl) >= 0
                              ? "text-success"
                              : "text-destructive"
                          }`}
                        >
                          ${Number(trade.pnl).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          trade.status === "executed"
                            ? "default"
                            : trade.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {trade.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(trade.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};