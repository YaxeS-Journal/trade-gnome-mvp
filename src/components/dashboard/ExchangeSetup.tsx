import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, AlertCircle } from "lucide-react";

interface ExchangeSetupProps {
  userId: string;
}

export const ExchangeSetup = ({ userId }: ExchangeSetupProps) => {
  const [showInfo, setShowInfo] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          Exchange API Setup
        </CardTitle>
        <CardDescription>
          Connect your exchange account to enable trading
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showInfo && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This MVP uses simulated trading for safety.
              To connect to a real exchange (Binance, Coinbase, etc.), you'll need to:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Generate API keys from your exchange</li>
                <li>Store them securely in the backend</li>
                <li>Implement exchange-specific API integration</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="p-4 rounded-lg bg-secondary space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Demo Mode Active</p>
              <p className="text-sm text-muted-foreground">
                Trading with simulated data for testing
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Next steps for production:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Add secure API key storage in backend</li>
            <li>Implement exchange connector (e.g., ccxt library)</li>
            <li>Add real-time price data fetching</li>
            <li>Enable actual order execution</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};