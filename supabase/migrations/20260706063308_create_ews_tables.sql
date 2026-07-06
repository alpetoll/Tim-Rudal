-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Create weather_anomaly_logs table
CREATE TABLE IF NOT EXISTS public.weather_anomaly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lahan_id UUID NOT NULL REFERENCES public.lahan(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  detected_value NUMERIC,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_anomaly_logs ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "Push subscriptions SELECT Policy" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions INSERT Policy" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions DELETE Policy" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Weather anomaly logs SELECT Policy" ON public.weather_anomaly_logs;

-- Create policies for push_subscriptions
CREATE POLICY "Push subscriptions SELECT Policy"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Push subscriptions INSERT Policy"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Push subscriptions DELETE Policy"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create policies for weather_anomaly_logs
CREATE POLICY "Weather anomaly logs SELECT Policy"
ON public.weather_anomaly_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lahan
    WHERE lahan.id = weather_anomaly_logs.lahan_id
      AND lahan.petani_id = auth.uid()
  )
);

-- pg_cron setup to check weather anomalies every 3 hours
-- Read Project URL and Service Role Key from Vault
SELECT cron.schedule(
  'check-weather-anomaly-job',
  '0 */3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL') || '/functions/v1/check-weather-anomaly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
