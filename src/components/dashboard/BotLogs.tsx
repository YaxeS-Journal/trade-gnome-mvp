import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Info, AlertTriangle, Terminal } from "lucide-react";

interface BotLogsProps {
  userId: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event_type: string;
  message: string;
  metadata?: any;
}

export const BotLogs = ({ userId }: BotLogsProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLogs();
    
    const channel = supabase
      .channel('bot-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bot_logs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setLogs(prev => [payload.new as LogEntry, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("bot_logs")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(100);

    if (data) {
      setLogs(data as LogEntry[]);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-warning" />;
      default: return <Info className="w-4 h-4 text-info" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, string> = {
      error: 'destructive',
      warn: 'warning',
      info: 'default'
    };
    return variants[level] || 'default';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          Bot Activity Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No logs yet. Start the bot to see activity.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getLevelBadge(log.level) as any} className="text-xs">
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.event_type}
                      </Badge>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.metadata && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
