-- Create bot_logs table for audit and error tracking
CREATE TABLE public.bot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own logs"
ON public.bot_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON public.bot_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_bot_logs_user_timestamp ON public.bot_logs(user_id, timestamp DESC);
CREATE INDEX idx_bot_logs_level ON public.bot_logs(level) WHERE level = 'error';